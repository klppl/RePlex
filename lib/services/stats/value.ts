import db from '../../db';
import { Prisma } from '@prisma/client';

export async function computeValue(where: Prisma.WatchHistoryWhereInput, showSeconds: number) {
    const [uniqueMoviesCount, uniqueEpisodesCount] = await Promise.all([
        db.watchHistory.groupBy({ by: ['ratingKey'], where: { ...where, mediaType: 'movie' } }),
        db.watchHistory.groupBy({ by: ['ratingKey'], where: { ...where, mediaType: 'episode' } }),
    ]);
    const movieCount = uniqueMoviesCount.length;
    const tvHours = showSeconds / 3600;
    const totalValue = Math.round((movieCount * 12.00) + ((tvHours / 10.0) * 15.49));
    const episodeCount = uniqueEpisodesCount.length;
    const pirateBayValue = (movieCount + episodeCount) * 150000;

    return { valueProposition: totalValue, pirateBayValue };
}
