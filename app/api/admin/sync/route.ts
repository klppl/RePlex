
import { NextRequest } from 'next/server';
import { verifyAdminSession } from '@/lib/auth-admin';
import { syncGlobalHistory } from '@/lib/services/sync';
import { syncUsers } from '@/lib/services/tautulli';
import { createStreamingResponse } from '@/lib/utils/streaming';

export const runtime = 'nodejs'; // Required for streaming? Or just standard. Nodejs is safer for Prisma.

export async function GET(req: NextRequest) {
    const session = await verifyAdminSession(req);
    if (!session) {
        return new Response('Unauthorized', { status: 401 });
    }

    return createStreamingResponse(async (send) => {
        // Determine date range (current year)
        const now = new Date();
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        const endOfYear = new Date(now.getFullYear(), 11, 31);

        send(`[ADMIN] Starting global sync from ${startOfYear.toDateString()} to ${endOfYear.toDateString()}...`);

        send(`[ADMIN] Phase 0: Syncing Users...`);
        const userCount = await syncUsers();
        send(`[ADMIN] User Sync Complete. Found ${userCount} users.`);

        const result = await syncGlobalHistory(startOfYear, endOfYear, (msg) => {
            send(`[SYNC] ${msg}`);
        });

        send(`[ADMIN] Sync Complete. Synced ${result.syncedDays} days, ${result.totalEntries} entries.`);
    });
}
