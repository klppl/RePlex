
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth-admin';
import { syncHistoryForUser } from '@/lib/services/sync';
import { getStats } from '@/lib/services/stats';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
    const session = await verifyAdminSession(req);
    if (!session) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id || isNaN(parseInt(id))) {
        return new NextResponse('Invalid ID', { status: 400 });
    }

    const userId = parseInt(id);
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            try {
                const year = new Date().getFullYear();
                const from = new Date(year, 0, 1);
                const to = new Date(); // Now

                controller.enqueue(encoder.encode(`[ADMIN] Starting refresh for user ID ${userId}...\n`));

                // 1. Sync
                controller.enqueue(encoder.encode(`[ADMIN] Syncing history from Tautulli (${year})...\n`));
                await syncHistoryForUser(userId, from, to, true, (msg) => {
                    controller.enqueue(encoder.encode(`[SYNC] ${msg}\n`));
                });
                controller.enqueue(encoder.encode(`[ADMIN] History Sync Complete.\n`));

                // 2. Stats
                controller.enqueue(encoder.encode(`[ADMIN] Generating stats...\n`));
                await getStats(userId, undefined, undefined, undefined, {
                    forceRefresh: true,
                    onProgress: (msg) => {
                        controller.enqueue(encoder.encode(`[STATS] ${msg}\n`));
                    }
                });
                controller.enqueue(encoder.encode(`[ADMIN] Success! Stats generated.\n`));
                controller.close();
            } catch (error: any) {
                controller.enqueue(encoder.encode(`[ERROR] Refresh failed: ${error.message}\n`));
                controller.close();
            }
        }
    });

    return new NextResponse(stream, {
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Transfer-Encoding': 'chunked',
            'X-Content-Type-Options': 'nosniff',
        },
    });
}
