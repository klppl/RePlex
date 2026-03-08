import { NextRequest } from 'next/server';
import { verifyAdminSession } from '@/lib/auth-admin';
import { processMetadataEnrichment } from '@/lib/services/metadata-enrichment';
import { createStreamingResponse } from '@/lib/utils/streaming';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const admin = await verifyAdminSession(req);
    if (!admin) {
        return new Response('Unauthorized', { status: 401 });
    }

    return createStreamingResponse(async (send) => {
        await processMetadataEnrichment(async (msg) => send(msg));
    }, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
    });
}
