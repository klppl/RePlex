import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth-admin';
import { processMetadataEnrichment } from '@/lib/services/metadata-enrichment';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const admin = await verifyAdminSession(req);
    if (!admin) {
        return new Response('Unauthorized', { status: 401 });
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            const sendLog = async (msg: string) => {
                controller.enqueue(encoder.encode(msg + '\n'));
            };

            try {
                await processMetadataEnrichment(sendLog);
            } catch (error: any) {
                await sendLog(`ERROR: Pipeline failed: ${error.message}`);
            } finally {
                controller.close();
            }
        }
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
}
