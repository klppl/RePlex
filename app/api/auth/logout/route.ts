import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
    const cookieStore = await cookies();

    // Explicitly delete with path to ensure it matches the set cookie
    cookieStore.delete({
        name: 'admin_session',
        path: '/',
    });

    return NextResponse.json({ success: true });
}
