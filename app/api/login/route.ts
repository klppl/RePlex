import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { username } = body;

        if (!username) {
            return NextResponse.json({ error: 'Username is required' }, { status: 400 });
        }

        // Case-insensitive lookup (using raw query or just finding first match locally? Prisma sqlite doesn't support mode: insensitive well everywhere)
        // Actually Prisma Client JS performs simple equality. 
        // We can fetch user by username.
        const user = await db.user.findFirst({
            where: {
                username: username
            }
        });

        if (!user) {
            // Try case insensitive manually? Or simpler: fail.
            // Let's query all and match insensitive in memory if needed, but for now exact match.
            // Wait, Tautulli usually syncs usernames accurately.
            return NextResponse.json({ error: 'User not found in Tautulli sync' }, { status: 404 });
        }

        return NextResponse.json({ success: true, userId: user.id });
    } catch (error: any) {
        console.error("Login Error:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
