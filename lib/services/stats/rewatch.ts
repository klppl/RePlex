import db from '../../db';
import { Prisma } from '@prisma/client';

/**
 * Per-user "Most Rewatched Episodes": episodes (by ratingKey) the user played
 * more than once in the period, ranked by play count. Top 10.
 */
export async function computeRewatchLeaderboard(
    where: Prisma.WatchHistoryWhereInput
): Promise<{ title: string; show?: string; count: number }[] | undefined> {
    const grouped = await db.watchHistory.groupBy({
        by: ['ratingKey'],
        where: { ...where, mediaType: 'episode', ratingKey: { not: null } },
        _count: { id: true },
        having: { id: { _count: { gt: 1 } } },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
    });

    if (grouped.length === 0) return undefined;

    const keys = grouped.map(g => g.ratingKey).filter((k): k is string => !!k);
    const rows = await db.watchHistory.findMany({
        where: { ...where, ratingKey: { in: keys } },
        select: { ratingKey: true, title: true, grandparentTitle: true, fullTitle: true },
        distinct: ['ratingKey'],
    });
    const titleMap = new Map(rows.map(r => [r.ratingKey, r]));

    return grouped.map(g => {
        const r = titleMap.get(g.ratingKey);
        const show = r?.grandparentTitle || undefined;
        const episode = r?.title;
        const label = show && episode ? `${show} – ${episode}` : (r?.fullTitle || episode || show || 'Unknown');
        return { title: label, show, count: g._count.id };
    });
}
