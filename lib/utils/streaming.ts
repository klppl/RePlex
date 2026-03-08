export function createStreamingResponse(
    handler: (send: (msg: string) => void) => Promise<void>,
    headers?: Record<string, string>
): Response {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        async start(controller) {
            const send = (msg: string) => {
                try {
                    controller.enqueue(encoder.encode(msg + '\n'));
                } catch (e) {
                    // Stream closed
                }
            };
            try {
                await handler(send);
            } catch (error: any) {
                send(`ERROR: ${error.message}`);
            } finally {
                try { controller.close(); } catch (e) {}
            }
        }
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Transfer-Encoding': 'chunked',
            'X-Content-Type-Options': 'nosniff',
            ...headers,
        },
    });
}
