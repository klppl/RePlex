import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { verifyAdminSession } from '@/lib/auth-admin';

export async function GET() {
    try {
        const count = await db.adminUser.count();
        const initialized = count > 0;

        let authenticated = false;
        if (await verifyAdminSession()) {
            authenticated = true;
        }

        return NextResponse.json({ initialized, authenticated });
    } catch (e) {
        return NextResponse.json({ error: 'Database check failed' }, { status: 500 });
    }
}
