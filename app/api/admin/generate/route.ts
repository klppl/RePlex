import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth-admin';
import { generateGlobalStats } from '@/lib/services/stats';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const session = await verifyAdminSession();
    if (!session) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    // Start background process
    (async () => {
        try {
            await generateGlobalStats(async (msg) => {
                await writer.write(encoder.encode(msg + '\n'));
            });
            await writer.write(encoder.encode('DONE\n'));
        } catch (error: any) {
            await writer.write(encoder.encode(`ERROR: ${error.message}\n`));
        } finally {
            await writer.close();
        }
    })();

    return new NextResponse(readable, {
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Transfer-Encoding': 'chunked',
            'X-Content-Type-Options': 'nosniff',
        },
    });
}
