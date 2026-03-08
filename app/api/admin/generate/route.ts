import { NextRequest } from 'next/server';
import { verifyAdminSession } from '@/lib/auth-admin';
import { generateGlobalStats } from '@/lib/services/stats';
import { createStreamingResponse } from '@/lib/utils/streaming';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const session = await verifyAdminSession();
    if (!session) {
        return new Response('Unauthorized', { status: 401 });
    }

    return createStreamingResponse(async (send) => {
        await generateGlobalStats(async (msg) => {
            send(msg);
        });
        send('DONE');
    });
}
