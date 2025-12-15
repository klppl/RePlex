
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth-admin';
import { syncGlobalHistory } from '@/lib/services/sync';

export const runtime = 'nodejs'; // Required for streaming? Or just standard. Nodejs is safer for Prisma.

export async function GET(req: NextRequest) {
    const session = await verifyAdminSession(req);
    if (!session) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            try {
                // Determine date range (current year)
                const now = new Date();
                const startOfYear = new Date(now.getFullYear(), 0, 1);
                const endOfYear = new Date(now.getFullYear(), 11, 31);

                controller.enqueue(encoder.encode(`[ADMIN] Starting global sync from ${startOfYear.toDateString()} to ${endOfYear.toDateString()}...\n`));

                const result = await syncGlobalHistory(startOfYear, endOfYear, (msg) => {
                    controller.enqueue(encoder.encode(`[SYNC] ${msg}\n`));
                });

                controller.enqueue(encoder.encode(`[ADMIN] Sync Complete. Synced ${result.syncedDays} days, ${result.totalEntries} entries.\n`));
                controller.close();
            } catch (error: any) {
                controller.enqueue(encoder.encode(`[ERROR] Sync failed: ${error.message}\n`));
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
