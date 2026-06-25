// crypto is not available in next/server for some runtimes, using node's crypto
import { pbkdf2, randomBytes, timingSafeEqual } from 'crypto';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import { jwtKey } from './jwt-config';

// OWASP-recommended minimum for PBKDF2-HMAC-SHA512.
const PBKDF2_ITERATIONS = 600_000;
const PBKDF2_KEYLEN = 64;

export async function hashPassword(password: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const salt = randomBytes(16).toString('hex');
        pbkdf2(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, 'sha512', (err, derivedKey) => {
            if (err) return reject(err);
            // Store iteration count so older hashes remain verifiable after tuning.
            resolve(`${salt}:${PBKDF2_ITERATIONS}:${derivedKey.toString('hex')}`);
        });
    });
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
        const parts = hash.split(':');
        // Format: salt:iterations:key (new) or salt:key (legacy, 1000 iterations).
        let salt: string, key: string, iterations: number;
        if (parts.length === 3) {
            [salt, , key] = parts;
            iterations = parseInt(parts[1], 10);
        } else if (parts.length === 2) {
            [salt, key] = parts;
            iterations = 1000;
        } else {
            return resolve(false);
        }
        if (!salt || !key || !Number.isFinite(iterations)) return resolve(false);

        pbkdf2(password, salt, iterations, PBKDF2_KEYLEN, 'sha512', (err, derivedKey) => {
            if (err) return reject(err);
            const keyBuffer = Buffer.from(key, 'hex');
            // timingSafeEqual throws on length mismatch, so guard first.
            if (keyBuffer.length !== derivedKey.length) return resolve(false);
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
        .sign(jwtKey);

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
        const { payload } = await jwtVerify(token, jwtKey);

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
        const { payload } = await jwtVerify(token, jwtKey);
        return payload;
    } catch (e) {
        return null;
    }
}
