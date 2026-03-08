
import { NextRequest } from 'next/server';
import { verifyAdminSession } from '@/lib/auth-admin';
import { syncHistoryForUser } from '@/lib/services/sync';
import { getStats } from '@/lib/services/stats';
import { createStreamingResponse } from '@/lib/utils/streaming';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
    const session = await verifyAdminSession(req);
    if (!session) {
        return new Response('Unauthorized', { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id || isNaN(parseInt(id))) {
        return new Response('Invalid ID', { status: 400 });
    }

    const userId = parseInt(id);

    return createStreamingResponse(async (send) => {
        const year = new Date().getFullYear();
        const from = new Date(year, 0, 1);
        const to = new Date(); // Now

        send(`[ADMIN] Starting refresh for user ID ${userId}...`);

        // 1. Sync
        send(`[ADMIN] Syncing history from Tautulli (${year})...`);
        await syncHistoryForUser(userId, from, to, true, (msg) => {
            send(`[SYNC] ${msg}`);
        });
        send(`[ADMIN] History Sync Complete.`);

        // 2. Stats
        send(`[ADMIN] Generating stats...`);
        await getStats(userId, undefined, undefined, undefined, {
            forceRefresh: true,
            onProgress: (msg) => {
                send(`[STATS] ${msg}`);
            }
        });
        send(`[ADMIN] Success! Stats generated.`);
    });
}
