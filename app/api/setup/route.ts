import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { checkConnection, syncUsers } from '@/lib/services/tautulli';
import { verifyAdminSession } from '@/lib/auth-admin';

export async function GET() {
    try {
        const session = await verifyAdminSession();
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const config = await db.tautulliConfig.findFirst({
            select: {
                ip: true,
                port: true,
                apiKey: true,
                useSsl: true,
                rootPath: true
            }
        });

        return NextResponse.json(config || {});
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch config' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        // 1. Check if setup is already complete
        const adminCount = await db.adminUser.count();
        if (adminCount > 0) {
            return NextResponse.json({ error: 'Setup already complete. Use Admin Dashboard.' }, { status: 403 });
        }

        // No session check needed for initial setup (as no admins exist)

        const body = await request.json();
        const { ip, port, apiKey, useSsl, rootPath } = body;

        if (!ip || !port || !apiKey) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // 1. Create Temporary Config Object
        const tempConfig = {
            id: 1,
            ip,
            port: Number(port),
            apiKey,
            useSsl: !!useSsl,
            rootPath: rootPath || ''
        };

        // 2. Test Connection
        const isConnected = await checkConnection(tempConfig);
        if (!isConnected) {
            return NextResponse.json({ error: 'Failed to connect to Tautulli. Check settings.' }, { status: 400 });
        }

        // 3. Save to DB
        await db.tautulliConfig.upsert({
            where: { id: 1 },
            update: tempConfig,
            create: tempConfig
        });

        // 4. Trigger Initial User Sync
        const syncedCount = await syncUsers();

        return NextResponse.json({ success: true, syncedUsers: syncedCount });
    } catch (error: any) {
        console.error("Setup Error:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
