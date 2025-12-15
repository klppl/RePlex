'use server';

import db from '@/lib/db';
import { signSession } from '@/lib/auth';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export async function validateLoginToken(token: string) {
    if (!token) return { error: "Missing token" };

    try {
        const user = await db.user.findUnique({
            where: { loginToken: token }
        });

        const now = new Date();

        if (!user) {
            return { error: "Invalid login link." };
        } else if (user.tokenExpiresAt && user.tokenExpiresAt < now) {
            return { error: "This login link has expired." };
        }

        // Success! Log them in.
        const sessionJwt = await signSession(user.id, user.username || `User ${user.id}`);

        (await cookies()).set('auth_token', sessionJwt, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 30 * 24 * 60 * 60, // 30 days
            path: '/'
        });

        // Return success so client can handle redirect or we can redirect here
        // Redirecting from Server Action works and is clean.
    } catch (error) {
        console.error("Login Token Error:", error);
        return { error: "An unexpected error occurred." };
    }

    // Redirect outside try-catch to avoid swallowing NEXT_REDIRECT error
    redirect('/dashboard');
}
