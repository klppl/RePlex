import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySession } from '@/lib/auth';
import { jwtVerify } from 'jose';
import { jwtKey } from '@/lib/jwt-config';
export async function middleware(request: NextRequest) {
    // 1. Admin Route Protection
    if (request.nextUrl.pathname.startsWith('/admin')) {
        const adminToken = request.cookies.get('admin_session')?.value;
        const isLoginPage = request.nextUrl.pathname === '/admin/login';

        let isAdmin = false;
        if (adminToken) {
            try {
                await jwtVerify(adminToken, jwtKey);
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
    // Always start from a clean header set: strip any client-supplied identity
    // headers so they can never be spoofed by a request without a valid token.
    const requestHeaders = new Headers(request.headers);
    requestHeaders.delete('x-user-id');
    requestHeaders.delete('x-username');

    const token = request.cookies.get('auth_token')?.value;
    if (token) {
        const session = await verifySession(token);
        if (session) {
            requestHeaders.set('x-user-id', session.userId.toString());
            requestHeaders.set('x-username', session.username);
        }
    }

    return NextResponse.next({
        request: { headers: requestHeaders }
    });
}

export const config = {
    matcher: ['/dashboard/:path*', '/api/:path*', '/admin/:path*'],
};
