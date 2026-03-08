import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { jwtKey } from './jwt-config';

export async function signSession(userId: number, username: string) {
    return new SignJWT({ userId, username })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('30d') // Long session
        .sign(jwtKey);
}

export async function verifySession(token: string) {
    try {
        const { payload } = await jwtVerify(token, jwtKey, { algorithms: ['HS256'] });
        return payload as { userId: number; username: string };
    } catch (e) {
        return null;
    }
}

export async function getSession() {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (!token) return null;
    return verifySession(token);
}

export async function logout() {
    const cookieStore = await cookies();
    cookieStore.delete('auth_token');
}
