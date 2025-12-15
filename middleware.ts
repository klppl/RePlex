import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySession } from '@/lib/auth';
import { jwtVerify } from 'jose';

const secret = process.env.JWT_SECRET;
if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error("FATAL: JWT_SECRET is not defined. Check your environment variables.");
}
const SECRET_KEY = secret || 'super-secret-key-change-this';
const key = new TextEncoder().encode(SECRET_KEY);
export async function middleware(request: NextRequest) {
    // 1. Admin Route Protection
    if (request.nextUrl.pathname.startsWith('/admin')) {
        const adminToken = request.cookies.get('admin_session')?.value;
        const isLoginPage = request.nextUrl.pathname === '/admin/login';

        let isAdmin = false;
        if (adminToken) {
            try {
                await jwtVerify(adminToken, key);
                isAdmin = true;
            } catch (e) { }
        }

        if (!isAdmin && !isLoginPage) {
            return NextResponse.redirect(new URL('/admin/login', request.url));
        }

        if (isAdmin && isLoginPage) {
            return NextResponse.redirect(new URL('/admin', request.url));
        }
    }

    // 2. User Session Handling (for header injection)

    const token = request.cookies.get('auth_token')?.value;

    if (token) {
        const session = await verifySession(token);
        if (session) {
            const requestHeaders = new Headers(request.headers);
            requestHeaders.set('x-user-id', session.userId.toString());
            requestHeaders.set('x-username', session.username);
            return NextResponse.next({
                request: { headers: requestHeaders }
            });
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/dashboard/:path*', '/api/:path*', '/admin/:path*'],
};
