import db from '../../db';
import { Prisma } from '@prisma/client';

export async function computeTechStats(where: Prisma.WatchHistoryWhereInput) {
    const [techRaw, transcodeCount, totalPlays, platformsRaw] = await Promise.all([
        db.watchHistory.aggregate({ where, _sum: { fileSize: true }, _count: { transcodeDecision: true } }),
        db.watchHistory.count({ where: { ...where, transcodeDecision: 'transcode' } }),
        db.watchHistory.count({ where }),
        db.watchHistory.groupBy({ by: ['player'], where: { ...where, player: { not: null } }, _count: { player: true }, orderBy: { _count: { player: 'desc' } }, take: 5 }),
    ]);

    // Transcode %
    const transcodePercent = totalPlays > 0 ? Math.round((transcodeCount / totalPlays) * 100) : 0;
    const topPlatforms = platformsRaw.map(p => ({
        platform: p.player || "Unknown",
        count: p._count.player
    }));

    const totalDataGB = techRaw._sum.fileSize ? Math.round(Number(techRaw._sum.fileSize) / (1024 * 1024 * 1024)) : 0;

    return { totalDataGB, transcodePercent, topPlatforms };
}
