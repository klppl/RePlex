import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { hashPassword, createAdminSession } from '@/lib/auth-admin';

export async function POST(request: Request) {
    try {
        // Prevent if admin already exists
        const count = await db.adminUser.count();
        if (count > 0) {
            return NextResponse.json({ error: 'Admin already initialized' }, { status: 403 });
        }

        const body = await request.json();
        const { username, password } = body;

        if (!username || !password) {
            return NextResponse.json({ error: 'Invalid credentials.' }, { status: 400 });
        }

        const hash = await hashPassword(password);

        await db.adminUser.create({
            data: {
                username,
                passwordHash: hash
            }
        });

        // Auto login
        await createAdminSession(username);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Admin Setup Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
