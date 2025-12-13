import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { verifyPassword, createAdminSession } from '@/lib/auth-admin';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { username, password } = body;

        const admin = await db.adminUser.findUnique({ where: { username } });
        if (!admin) {
            return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
        }

        const isValid = await verifyPassword(password, admin.passwordHash);
        if (!isValid) {
            return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
        }

        await createAdminSession(username);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
