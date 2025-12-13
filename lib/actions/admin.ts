'use server'

import db from '../db';
import { revalidatePath } from 'next/cache';
import { hashPassword } from '../auth-admin';
import { getStats } from '../services/stats';
import { syncUsers } from '../services/tautulli';
import { SignJWT } from 'jose';
import { cookies } from 'next/headers';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'changeme');

export interface AdminUserType {
    id: number;
    username: string | null;
    email: string | null;
    thumb: string | null;
    isActive: boolean;
    historyCount: number;
    statsGeneratedAt: Date | null;
}

export async function getAdminUsers(): Promise<AdminUserType[]> {
    try {
        const users = await db.user.findMany({
            include: {
                _count: {
                    select: { history: true }
                }
            },
            orderBy: { id: 'asc' }
        });

        return users.map(u => ({
            id: u.id,
            username: u.username,
            email: u.email,
            thumb: u.thumb,
            isActive: u.isActive,
            historyCount: u._count.history,
            statsGeneratedAt: u.statsGeneratedAt
        }));
    } catch (error) {
        console.error("Failed to fetch users:", error);
        return [];
    }
}

// --- GENERATION ACTIONS ---

import { syncHistoryForUser } from '../services/sync';

export async function generateUserStats(userId: number) {
    try {
        // 1. Sync History First (Current Year)
        // Wrapperr is typically annual, so we sync the current year.
        const year = new Date().getFullYear();
        const from = new Date(year, 0, 1);
        const to = new Date(); // Now

        console.log(`[ADMIN] Syncing history for user ${userId} (${year})...`);
        await syncHistoryForUser(userId, from, to, true); // Force sync

        // 2. Generate stats (this will update the cache in db.user)
        console.log(`[ADMIN] Generating stats for user ${userId}...`);
        await getStats(userId, undefined, undefined, undefined, { forceRefresh: true });

        revalidatePath('/admin');
        return { success: true };
    } catch (error: any) {
        console.error(`Failed to generate stats for ${userId}:`, error);
        return { success: false, error: error.message };
    }
}

export async function generateAllStats() {
    try {
        const users = await db.user.findMany({ select: { id: true } });
        let errors = 0;

        for (const user of users) {
            try {
                await getStats(user.id, undefined, undefined, undefined, { forceRefresh: true });
            } catch (e) {
                console.error(`Error generating for ${user.id}`, e);
                errors++;
            }
        }

        revalidatePath('/admin');
        return { success: true, errors };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function deleteUser(userId: number) {
    try {
        // Delete related data first
        await db.watchHistory.deleteMany({ where: { userId } });
        await db.syncLog.deleteMany({ where: { userId } });
        // Delete user
        await db.user.delete({ where: { id: userId } });
        revalidatePath('/admin');
        return { success: true };
    } catch (error) {
        console.error("Failed to delete user:", error);
        return { success: false, error: "Failed to delete user" };
    }
}

export async function purgeSystem() {
    try {
        // Nuke everything
        await db.watchHistory.deleteMany({});
        await db.syncLog.deleteMany({});
        await db.user.deleteMany({});
        await db.tautulliConfig.deleteMany({});
        await db.adminUser.deleteMany({}); // Removing admin triggers /setup redirect

        revalidatePath('/');
        return { success: true };
    } catch (error) {
        console.error("Failed to purge system:", error);
        return { success: false, error: "Failed to purge system" };
    }
}

// --- SETUP & CONFIG ACTIONS ---

export async function getSystemStatus() {
    try {
        const adminCount = await db.adminUser.count();
        const config = await db.tautulliConfig.findFirst();
        return {
            initialized: adminCount > 0 && !!config,
            hasAdmin: adminCount > 0,
            config: config
        };
    } catch (error) {
        return { initialized: false, hasAdmin: false, config: null };
    }
}

export async function saveSystemConfig(data: any) {
    try {
        // 1. Tautulli Config
        const configData = {
            ip: data.ip,
            port: parseInt(data.port),
            apiKey: data.apiKey,
            useSsl: data.useSsl === 'on' || data.useSsl === true,
            rootPath: data.rootPath || ''
        };

        const existing = await db.tautulliConfig.findFirst();
        if (existing) {
            await db.tautulliConfig.update({ where: { id: existing.id }, data: configData });
        } else {
            await db.tautulliConfig.create({ data: configData });
        }

        // 2. Admin User (if creating new)
        if (data.username && data.password) {
            // Simple hash replacement since I can't import bcrypt easily in this context without verification
            // In a real app we'd use bcrypt.hash(data.password, 10).
            // For now, let's assume direct storage or reuse the auth helper if I find it.
            // I'll assume plaintext for this specific migration step OR 
            // I should really check how it was done.
            const hashedPassword = await hashPassword(data.password);

            await db.adminUser.create({
                data: {
                    username: data.username,
                    passwordHash: hashedPassword
                }
            });

            // Auto-login (set cookie)
            const token = await new SignJWT({ username: data.username })
                .setProtectedHeader({ alg: 'HS256' })
                .setExpirationTime('24h')
                .sign(JWT_SECRET);

            (await cookies()).set('admin_token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                maxAge: 60 * 60 * 24,
                path: '/'
            });
        }

        revalidatePath('/');
        revalidatePath('/admin');
        return { success: true };
    } catch (error: any) {
        console.error("Setup failed:", error);
        return { success: false, error: error.message || "Setup failed" };
    }
}

export async function syncTautulliUsers() {
    try {
        const count = await syncUsers();
        revalidatePath('/admin');
        return { success: true, count };
    } catch (error: any) {
        console.error("Sync failed:", error);
        return { success: false, error: error.message };
    }
}
