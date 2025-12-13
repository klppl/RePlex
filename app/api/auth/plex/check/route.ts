import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import db from '@/lib/db';
import { signSession } from '@/lib/auth';
import { syncUsers } from '@/lib/services/tautulli';

const PLEX_CLIENT_ID = 'replex-web-client';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const pinId = searchParams.get('id');

        if (!pinId) {
            return NextResponse.json({ error: 'Missing pin ID' }, { status: 400 });
        }

        // 1. Check Pin Status
        const res = await fetch(`https://plex.tv/api/v2/pins/${pinId}`, {
            headers: {
                'X-Plex-Client-Identifier': PLEX_CLIENT_ID,
                'Accept': 'application/json'
            }
        });

        if (!res.ok) throw new Error('Failed to check pin');
        const data = await res.json();

        // Data usually has { authToken, clientIdentifier, ... }

        // If auth_token is not present, user has not signed in yet.
        if (!data.authToken) {
            return NextResponse.json({ status: 'pending' });
        }

        // 2. User has signed in! Get User Details.
        // Ensure we explicitly request JSON, as Plex defaults to XML.
        // The correct endpoint for basic user info is `https://plex.tv/users/account.json` or `https://plex.tv/api/v2/user`

        const userRes = await fetch('https://plex.tv/api/v2/user', {
            headers: {
                'X-Plex-Client-Identifier': PLEX_CLIENT_ID,
                'X-Plex-Token': data.authToken,
                'Accept': 'application/json'
            }
        });

        if (!userRes.ok) throw new Error(`Invalid Plex Token or User Fetch Failed (${userRes.status})`);

        // Plex V2 API Logic
        const userData = await userRes.json();

        // V2 structure: { id, email, username, thumb, ... } directly, OR inside user?
        // It's usually minimal and direct.
        // But let's log it if debugging needed.
        // console.log("Plex User Data:", userData);

        // V2 returns the user object directly usually.
        // V1 (users/account.json) returns { user: { ... } }

        // Let's safe access
        const plexUser = userData.user || userData;
        const plexId = plexUser.id;
        const plexUsername = plexUser.username || plexUser.email;

        if (!plexId) throw new Error("Could not retrieve Plex User ID");

        // 3. Match with DB
        // We treat Tautulli User ID as Plex User ID.
        // Note: Tautulli syncs users. If user is new to Tautulli, they might not be in our DB yet.
        // We can auto-create functionality if we wanted, or fetch from Tautulli.
        // But for wrapped, we need history. If they have no history, they might not be synced.
        // Let's check DB.

        // Let's check DB.

        let dbUser = await db.user.findUnique({ where: { id: plexId } });

        if (!dbUser) {
            console.log(`User ${plexId} not found locally. Attempting Tautulli sync...`);
            try {
                // Attempt to sync users from Tautulli
                await syncUsers();
                // Try finding again
                dbUser = await db.user.findUnique({ where: { id: plexId } });
            } catch (syncError) {
                console.error("Failed to sync users during login:", syncError);
            }
        }

        if (!dbUser) {
            return NextResponse.json({ error: 'User not found in Tautulli. Please ensure you have watched content on this server.' }, { status: 404 });
        }

        // 4. Create Session
        const token = await signSession(dbUser.id, dbUser.username || plexUsername);
        const cookieStore = await cookies();

        cookieStore.set('auth_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 30 // 30 Days
        });

        return NextResponse.json({ status: 'success', userId: dbUser.id });

    } catch (error: any) {
        console.error("Plex Check Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
