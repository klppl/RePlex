import { NextResponse } from 'next/server';
import { getStats } from '@/lib/services/stats';
import { getSession } from '@/lib/auth';
import { verifyAdminSession } from '@/lib/auth-admin';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');
        const year = searchParams.get('year');
        const refresh = searchParams.get('refresh') === 'true';

        if (!userId) {
            return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
        }

        // Authorization: a user may only read their own stats; admins may read anyone's.
        const [session, admin] = await Promise.all([getSession(), verifyAdminSession()]);
        if (!session && !admin) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (!admin && session!.userId !== Number(userId)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const stats = await getStats(
            Number(userId),
            year ? Number(year) : undefined,
            undefined,
            undefined,
            { forceRefresh: refresh }
        );

        return NextResponse.json(stats);
    } catch (error: any) {
        console.error("Stats API Error:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
