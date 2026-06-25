import { NextResponse } from 'next/server';
import { syncHistoryForUser } from '@/lib/services/sync';
import { getCurrentReportingYear } from '@/lib/utils/date';
import { createStreamingResponse } from '@/lib/utils/streaming';
import { getSession } from '@/lib/auth';
import { verifyAdminSession } from '@/lib/auth-admin';

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

    // Authorization: a user may only sync their own history; admins may sync anyone's.
    const [session, admin] = await Promise.all([getSession(), verifyAdminSession()]);
    if (!session && !admin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!admin && session!.userId !== Number(userId)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const now = new Date();
    const currentYear = await getCurrentReportingYear();
    const fromDate = from ? new Date(from) : new Date(currentYear, 0, 1);
    const toDate = to ? new Date(to) : now;

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
        return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
    }

    const signal = request.signal;

    return createStreamingResponse(async (send) => {
        send(`Starting sync for User ${userId}...`);

        const result = await syncHistoryForUser(
            Number(userId),
            fromDate,
            toDate,
            force,
            (msg) => send(msg),
            signal // Pass the abort signal
        );

        // Send final result as JSON string line
        send('SYNC_COMPLETE:' + JSON.stringify(result));
    });
}
