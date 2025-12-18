'use server'

import db from '../db';
import { revalidatePath } from 'next/cache';
import { hashPassword, verifyAdminSession, key as JWT_SECRET } from '../auth-admin';
import { getStats } from '../services/stats';
import { syncUsers } from '../services/tautulli';
import { syncHistoryForUser, syncGlobalHistory } from '../services/sync';
import { SignJWT } from 'jose';
import { cookies } from 'next/headers';

const MASK = "••••••••";

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
        const session = await verifyAdminSession();
        if (!session) {
            return [];
        }

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



// Re-download history for specific user and regen stats
export async function refreshUser(userId: number) {
    try {
        const session = await verifyAdminSession();
        if (!session) throw new Error("Unauthorized");

        const year = new Date().getFullYear();
        const from = new Date(year, 0, 1);
        const to = new Date(); // Now

        console.log(`[ADMIN] Refreshing user ${userId}: Force syncing history from Tautulli (${year})...`);

        // Force download history
        await syncHistoryForUser(userId, from, to, true);

        // Generate stats
        console.log(`[ADMIN] User ${userId} history synced. Regenerating stats...`);
        await getStats(userId, undefined, undefined, undefined, { forceRefresh: true });

        revalidatePath('/admin');
        return { success: true };
    } catch (error: any) {
        console.error(`Failed to refresh user ${userId}:`, error);
        return { success: false, error: error.message };
    }
}

export async function generateUserStats(userId: number) {
    try {
        const session = await verifyAdminSession();
        if (!session) throw new Error("Unauthorized");

        // 1. Sync History First (Current Year)
        // Wrapperr is typically annual, so we sync the current year.
        const year = new Date().getFullYear();
        const from = new Date(year, 0, 1);
        const to = new Date(); // Now

        // OPTIMIZATION: Check if we already have data for this user this year
        const hasHistory = await db.watchHistory.findFirst({
            where: {
                userId,
                date: { gte: from }
            }
        });

        if (hasHistory) {
            console.log(`[ADMIN] Data exists for user ${userId} (${year}). Skipping download, generating stats directly.`);
        } else {
            console.log(`[ADMIN] No data found for user ${userId} (${year}). Syncing history...`);
            await syncHistoryForUser(userId, from, to, true); // Force sync
        }

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
        const session = await verifyAdminSession();
        if (!session) throw new Error("Unauthorized");

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
        const session = await verifyAdminSession();
        if (!session) throw new Error("Unauthorized");

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

export async function deleteUserReport(userId: number) {
    try {
        const session = await verifyAdminSession();
        if (!session) throw new Error("Unauthorized");

        await db.user.update({
            where: { id: userId },
            data: {
                statsCache: null,
                statsGeneratedAt: null
            }
        });

        revalidatePath('/admin');
        return { success: true };
    } catch (error) {
        console.error("Failed to delete user report:", error);
        return { success: false, error: "Failed to delete report" };
    }
}

export async function generateLoginLink(userId: number) {
    try {
        const session = await verifyAdminSession();
        if (!session) throw new Error("Unauthorized");

        // Generate 32 bytes hex token (64 hex chars) - high entropy
        // We use dynamic import for crypto to be safe if this file is imported in edge-like contexts (though actions are server)
        const { randomBytes } = await import('crypto');
        const token = randomBytes(32).toString('hex');

        const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours validity

        await db.user.update({
            where: { id: userId },
            data: {
                loginToken: token,
                tokenExpiresAt: expiresAt
            }
        });

        revalidatePath('/admin');
        return { success: true, token };
    } catch (error: any) {
        console.error("Failed to generate link:", error);
        return { success: false, error: error.message || "Failed to generate link" };
    }
}

export async function purgeAllData() {
    try {
        const session = await verifyAdminSession();
        if (!session) throw new Error("Unauthorized");

        // Nuke everything
        await db.watchHistory.deleteMany({});
        await db.syncLog.deleteMany({});
        await db.user.deleteMany({});
        await db.tautulliConfig.deleteMany({});
        await db.aiConfig.deleteMany({});
        await db.mediaConfig.deleteMany({});
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

        const initialized = adminCount > 0 && !!config;
        const hasAdmin = adminCount > 0;

        // If not authenticated, DO NOT return sensitive config
        const session = await verifyAdminSession();
        if (!session) {
            return {
                initialized,
                hasAdmin,
                config: null,
                aiConfig: null,
                mediaConfig: null
            };
        }

        // If authenticated, mask secrets
        const aiConfig = await db.aiConfig.findFirst();
        const mediaConfig = await db.mediaConfig.findFirst();

        // Get admin user specific preferences
        const adminUser = await db.adminUser.findFirst({
            where: { username: session.username as string }
        });

        return {
            initialized,
            hasAdmin,
            config: config ? { ...config, apiKey: MASK } : null,
            aiConfig: aiConfig ? { ...aiConfig, apiKey: aiConfig.apiKey ? MASK : null } : null,
            mediaConfig: mediaConfig ? {
                ...mediaConfig,
                tmdbApiKey: mediaConfig.tmdbApiKey ? MASK : null,
                tvdbApiKey: mediaConfig.tvdbApiKey ? MASK : null,
                omdbApiKey: mediaConfig.omdbApiKey ? MASK : null
            } : null,
            isFirstRunDismissed: adminUser?.isFirstRunDismissed || false
        };
    } catch (error) {
        return { initialized: false, hasAdmin: false, config: null, aiConfig: null, mediaConfig: null, isFirstRunDismissed: false };
    }
}

export async function saveSystemConfig(data: any) {
    try {
        // Special case: Allow if no admin users exist (Setup flow)
        const adminCount = await db.adminUser.count();
        if (adminCount > 0) {
            const session = await verifyAdminSession();
            if (!session) throw new Error("Unauthorized");
        }

        // 1. Tautulli Config
        const existing = await db.tautulliConfig.findFirst();

        const configData = {
            ip: data.ip,
            port: parseInt(data.port),
            apiKey: data.apiKey === MASK && existing ? existing.apiKey : data.apiKey,
            useSsl: data.useSsl === 'on' || data.useSsl === true,
            rootPath: data.rootPath || ''
        };

        if (existing) {
            await db.tautulliConfig.update({ where: { id: existing.id }, data: configData });
        } else {
            // If creating new but sending mask, that's invalid, but UI shouldn't allow it.
            if (configData.apiKey === MASK) throw new Error("Invalid API Key");
            await db.tautulliConfig.create({ data: configData });
        }

        // 2. AI Config
        const existingAi = await db.aiConfig.findFirst();

        const aiData = {
            enabled: data.aiEnabled === 'on' || data.aiEnabled === true,
            apiKey: (data.aiKey === MASK && existingAi) ? existingAi.apiKey : (data.aiKey || null),
            instructions: data.aiInstructions || null,
            // default model for now
        };

        if (existingAi) {
            await db.aiConfig.update({ where: { id: existingAi.id }, data: aiData });
        } else {
            await db.aiConfig.create({ data: aiData });
        }

        // 3. Media Config
        const existingMedia = await db.mediaConfig.findFirst();

        const mediaData = {
            tmdbApiKey: (data.tmdbApiKey === MASK && existingMedia) ? existingMedia.tmdbApiKey : (data.tmdbApiKey || null),
            tvdbApiKey: (data.tvdbApiKey === MASK && existingMedia) ? existingMedia.tvdbApiKey : (data.tvdbApiKey || null),
            omdbApiKey: (data.omdbApiKey === MASK && existingMedia) ? existingMedia.omdbApiKey : (data.omdbApiKey || null),
        };

        if (existingMedia) {
            await db.mediaConfig.update({ where: { id: existingMedia.id }, data: mediaData });
        } else {
            await db.mediaConfig.create({ data: mediaData });
        }

        // 4. Admin User (if creating new)
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

            (await cookies()).set('admin_session', token, {
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
        const session = await verifyAdminSession();
        if (!session) throw new Error("Unauthorized");

        const count = await syncUsers();
        revalidatePath('/admin');
        return { success: true, count };
    } catch (error: any) {
        console.error("Sync failed:", error);
        return { success: false, error: error.message };
    }
}

export async function syncAllUsersHistory() {
    try {
        const session = await verifyAdminSession();
        if (!session) throw new Error("Unauthorized");

        // Current Year Logic
        const now = new Date();
        const startOfYear = new Date(now.getFullYear(), 0, 1); // Jan 1st
        const endOfYear = new Date(now.getFullYear(), 11, 31); // Dec 31st

        console.log(`[ADMIN] Starting global sync from ${startOfYear.toDateString()} to ${endOfYear.toDateString()}...`);

        const res = await syncGlobalHistory(startOfYear, endOfYear, (msg) => {
            console.log(`[SYNC] ${msg}`);
        });

        return {
            success: true,
            summary: `Global Sync Complete. Processed ${res.syncedDays} days and ${res.totalEntries} entries.`,
            details: res
        };

    } catch (error: any) {
        console.error("Global Sync failed:", error);
        return { success: false, error: error.message || "Global Sync failed" };
    }
}

export async function dismissFirstRun() {
    try {
        const session = await verifyAdminSession();
        if (!session) throw new Error("Unauthorized");

        // We assume single admin or update the current one
        await db.adminUser.update({
            where: { username: session.username as string },
            data: { isFirstRunDismissed: true }
        });

        revalidatePath('/admin');
        return { success: true };
    } catch (error) {
        return { success: false, error: "Failed to update preference of first run" };
    }
}
