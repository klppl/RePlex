import { NextResponse } from 'next/server';
import { getStats } from '@/lib/services/stats';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');
        const year = searchParams.get('year');
        const refresh = searchParams.get('refresh') === 'true';

        if (!userId) {
            return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
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
