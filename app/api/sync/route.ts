import { NextResponse } from 'next/server';
import { syncHistoryForUser } from '@/lib/services/sync';

export const runtime = 'nodejs'; // Use nodejs runtime for streaming if needed, or edge. 'nodejs' is safer for Prisma.

export async function POST(request: Request) {
    let body;
    try {
        body = await request.json();
    } catch (e) {
        return NextResponse.json({ error: 'Invalid or empty request body' }, { status: 400 });
    }
    const { userId, from, to, force } = body;

    if (!userId) {
        return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    const now = new Date();
    const fromDate = from ? new Date(from) : new Date(now.getFullYear(), 0, 1);
    const toDate = to ? new Date(to) : now;

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
        return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
    }

    // Create a streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        async start(controller) {
            // Helper to safely write to the stream
            const send = (msg: string) => {
                try {
                    controller.enqueue(encoder.encode(msg));
                } catch (e) {
                    // Stream probably closed, ignore
                }
            };

            try {
                send(`Starting sync for User ${userId}...\n`);

                const result = await syncHistoryForUser(
                    Number(userId),
                    fromDate,
                    toDate,
                    force,
                    (msg) => send(msg + '\n'),
                    request.signal // Pass the abort signal
                );

                // Send final result as JSON string line
                send('SYNC_COMPLETE:' + JSON.stringify(result) + '\n');
                controller.close();
            } catch (error: any) {
                if (error.message === 'Sync operation aborted by user' || error.message.includes('aborted')) {
                    // Normal abort, close quietly
                    try { controller.close(); } catch (e) { }
                    return;
                }

                console.error("Sync API Error:", error);
                send('ERROR:' + (error.message || "Internal Server Error") + '\n');
                try { controller.close(); } catch (e) { }
            }
        }
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Transfer-Encoding': 'chunked',
            'X-Content-Type-Options': 'nosniff',
        },
    });
}
