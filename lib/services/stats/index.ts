import db from '../../db';
import { Prisma } from '@prisma/client';
import { getCurrentReportingYear } from '@/lib/utils/date';
import { computeDuration } from './duration';
import { computeActors } from './actors';
import { computeGenres } from './genres';
import { computeDecades } from './decades';
import { computeActivity } from './activity';
import { computeTechStats } from './tech';
import { computeBingeAndCommitment } from './binge';
import { computeLeaderboard } from './leaderboard';
import { computeQuality } from './quality';
import { generateAiSummary } from './ai-summary';
import { computeValue } from './value';

export type { StatsResult } from './types';
import type { StatsResult } from './types';

export async function getStats(userId: number, year?: number, from?: Date, to?: Date, options: { forceRefresh?: boolean, onProgress?: (msg: string) => void } = {}): Promise<StatsResult> {
    if (!year) year = await getCurrentReportingYear();
    const startDate = from || new Date(year, 0, 1);
    const endDate = to || new Date(year + 1, 0, 1);

    const aiConfig = await db.aiConfig.findFirst();
    const appConfig = await db.appConfig.findFirst();

    if (!options.forceRefresh) {
        const user = await db.user.findUnique({
            where: { id: userId },
            select: { statsCache: true, statsGeneratedAt: true }
        });
        if (user?.statsCache) {
            try {
                const cached = JSON.parse(user.statsCache) as StatsResult;
                // Optional: Check if cache is for the correct year if we stored metadata?
                // For now, assume cache is valid for the default request.
                return cached;
            } catch (e) {
                console.error("Failed to parse cache", e);
            }
        }
    }

    const where: Prisma.WatchHistoryWhereInput = {
        userId,
        date: {
            gte: startDate,
            lt: endDate
        }
    };

    // 1. Existing Stats (Condensed) - Group 1: Parallel queries
    const [splitAgg, oldestMovieRaw, oldestShowRaw, allActorsRaw, allGenresRaw, decadesRaw] = await Promise.all([
        db.watchHistory.groupBy({ by: ['mediaType'], where, _sum: { duration: true, fileSize: true } }),
        db.watchHistory.findFirst({ where: { ...where, mediaType: 'movie', year: { not: null, gt: 1800 } }, orderBy: { year: 'asc' }, select: { title: true, year: true } }),
        db.watchHistory.findFirst({ where: { ...where, mediaType: 'episode', year: { not: null, gt: 1800 } }, orderBy: { year: 'asc' }, select: { grandparentTitle: true, year: true } }),
        db.watchHistory.findMany({ where: { ...where, actors: { not: null } }, select: { actors: true, mediaType: true, title: true, grandparentTitle: true, duration: true } }),
        db.watchHistory.findMany({ where: { ...where, genres: { not: null } }, select: { genres: true } }),
        db.watchHistory.findMany({ where: { ...where, year: { not: null } }, select: { year: true } }),
    ]);

    // Duration computation
    const { totalDuration, totalSeconds, movieSeconds, showSeconds, totalBandwidth } = computeDuration(splitAgg);

    // Sync-independent computations in parallel
    const [
        yourStan,
        genreWheel,
        { timeTraveler, averageYear },
        { lazyDay, activityType },
        techStats,
        { bingeRecord, commitmentIssues },
    ] = await Promise.all([
        computeActors(allActorsRaw),
        Promise.resolve(computeGenres(allGenresRaw)),
        Promise.resolve(computeDecades(decadesRaw)),
        computeActivity(userId, startDate, endDate),
        computeTechStats(where),
        computeBingeAndCommitment(where),
    ]);

    // Longest Break
    const longestBreakRaw = await db.$queryRaw<{ title: string, diff: number }[]>`
      SELECT COALESCE(NULLIF(grandparentTitle, ''), title) as title, (MAX(date/1000) - MIN(date/1000)) as diff
      FROM WatchHistory
      WHERE userId = ${userId} AND date >= ${startDate.getTime()} AND date < ${endDate.getTime()} AND ratingKey IS NOT NULL
      GROUP BY ratingKey HAVING COUNT(*) > 1 ORDER BY diff DESC LIMIT 1
    `;
    let longestBreak;
    if (longestBreakRaw.length > 0) {
        const days = Math.floor(Number(longestBreakRaw[0].diff) / 86400);
        if (days >= 1) longestBreak = { title: longestBreakRaw[0].title, days: days };
    }

    // Top Show By Episodes
    const mostEpisodesRaw = await db.watchHistory.groupBy({
        by: ['grandparentTitle'],
        where: { ...where, mediaType: 'episode' },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 1
    });
    let topShowByEpisodes;
    if (mostEpisodesRaw.length > 0) {
        const raw = mostEpisodesRaw[0] as any;
        topShowByEpisodes = { title: raw.grandparentTitle || "Unknown", count: raw._count.id || 0 };
    }

    // Parallel: leaderboard, quality, value, AI summary
    const hasData = totalSeconds > 0;

    const anonymize = appConfig?.anonymizeLeaderboard ?? true;

    const [comparison, qualityStats, { valueProposition, pirateBayValue }] = await Promise.all([
        computeLeaderboard(userId, totalSeconds, startDate, endDate, anonymize),
        computeQuality(where, userId),
        computeValue(where, showSeconds),
    ]);

    // AI Summary (after other stats are computed, since it needs statsContext)
    let aiSummary: string | undefined = undefined;
    if (hasData && (options.forceRefresh || !aiSummary)) {
        const statsContext = {
            user: { id: userId, year },
            totalDuration,
            lazyDay,
            vibe: activityType,
            stan: yourStan,
            genreWheel,
            binge: bingeRecord,
            commitmentIssues: { count: commitmentIssues.count, titles: commitmentIssues.titles },
            tech: { data: techStats.totalDataGB, transcodes: techStats.transcodePercent, platforms: techStats.topPlatforms },
            timeTraveler,
            longestBreak,
            topShowByEpisodes
        };
        aiSummary = await generateAiSummary(aiConfig, statsContext, options);
    }

    // Check sync status
    const syncCount = await db.syncLog.count({
        where: {
            userId,
            date: {
                gte: startDate,
                lt: endDate
            },
            completed: true
        }
    });

    const result: StatsResult = {
        totalDuration, totalSeconds, lazyDay, activityType,
        oldestMovie: oldestMovieRaw ? { title: oldestMovieRaw.title, year: oldestMovieRaw.year! } : undefined,
        oldestShow: oldestShowRaw ? { title: oldestShowRaw.grandparentTitle!, year: oldestShowRaw.year! } : undefined,
        longestBreak, mediaTypeSplit: { movies: movieSeconds, shows: showSeconds }, topShowByEpisodes,
        yourStan,
        genreWheel,
        timeTraveler,
        averageYear,
        totalBandwidth,
        bingeRecord,
        techStats: { totalDataGB: techStats.totalDataGB, transcodePercent: techStats.transcodePercent, topPlatforms: techStats.topPlatforms },
        commitmentIssues,
        aiSummary,
        valueProposition,
        pirateBayValue,
        comparison,
        qualityStats,
        hasSynced: syncCount > 0
    };

    // Cache the result
    try {
        await db.user.update({
            where: { id: userId },
            data: {
                statsCache: JSON.stringify(result),
                statsGeneratedAt: new Date()
            }
        });
    } catch (e) {
        console.error("Failed to save stats to cache", e);
    }

    return result;
}

export async function generateGlobalStats(onProgress?: (msg: string) => void) {
    const users = await db.user.findMany({ select: { id: true, username: true } });
    const total = users.length;

    if (onProgress) onProgress(`INFO: Starting generation for ${total} users...`);

    const CONCURRENCY = 3;
    let completed = 0;

    for (let i = 0; i < users.length; i += CONCURRENCY) {
        const batch = users.slice(i, i + CONCURRENCY);
        await Promise.all(batch.map(async (user) => {
            completed++;
            const progress = Math.round((completed / total) * 100);
            if (onProgress) onProgress(`GENERATING: [${completed}/${total}] ${user.username || 'User ' + user.id} (${progress}%)`);
            try {
                await getStats(user.id, undefined, undefined, undefined, { forceRefresh: true });
            } catch (e: any) {
                if (onProgress) onProgress(`ERROR: Failed for ${user.username}: ${e.message}`);
            }
        }));
    }
    if (onProgress) onProgress(`INFO: Generation Complete!`);
}
