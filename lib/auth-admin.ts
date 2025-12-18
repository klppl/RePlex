// crypto is not available in next/server for some runtimes, using node's crypto
import { pbkdf2, randomBytes, timingSafeEqual } from 'crypto';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

const secret = process.env.JWT_SECRET;
if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error("FATAL: JWT_SECRET is not defined. Check your environment variables.");
}
const SECRET_KEY = secret || 'super-secret-key-change-this';
export const key = new TextEncoder().encode(SECRET_KEY);

export async function hashPassword(password: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const salt = randomBytes(16).toString('hex');
        pbkdf2(password, salt, 1000, 64, 'sha512', (err, derivedKey) => {
            if (err) reject(err);
            resolve(`${salt}:${derivedKey.toString('hex')}`);
        });
    });
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
        const [salt, key] = hash.split(':');
        if (!salt || !key) resolve(false);

        pbkdf2(password, salt, 1000, 64, 'sha512', (err, derivedKey) => {
            if (err) reject(err);
            const keyBuffer = Buffer.from(key, 'hex');
            resolve(timingSafeEqual(keyBuffer, derivedKey));
        });
    });
}

export async function createAdminSession(username: string) {
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 1 day
    const token = await new SignJWT({ username, role: 'admin' })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('24h')
        .sign(key);

    const cookieStore = await cookies();
    cookieStore.set('admin_session', token, {
        expires,
        httpOnly: true,
        path: '/',
        secure: process.env.NODE_ENV === 'production' && process.env.DISABLE_SECURE_COOKIES !== 'true',
        sameSite: 'lax'
    });
}

export async function verifyAdminSession(req?: NextRequest) {
    const cookieStore = req ? req.cookies : await cookies();
    const token = cookieStore.get('admin_session')?.value;

    if (!token) return null;

    try {
        const { payload } = await jwtVerify(token, key);

        // Extra security: Ensure the user actually exists in the DB
        const cx = await import('@/lib/db');
        const user = await cx.default.adminUser.findFirst({
            where: { username: payload.username as string }
        });

        if (!user) {
            // console.warn("Admin session verification failed: User not found in DB", payload.username);
            return null;
        }

        return payload;
    } catch (e) {
        console.error("Admin session verification error:", e);
        return null;
    }
}
export async function verifyAdminToken(token: string) {
    try {
        const { payload } = await jwtVerify(token, key);
        return payload;
    } catch (e) {
        return null;
    }
}
