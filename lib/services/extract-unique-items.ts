import db from '../db';

export interface UniqueMediaItem {
    title: string;
    year?: number;
    type: 'movie' | 'series';
    ratingKey: string;
}

export async function extractUniqueItems(): Promise<Map<string, UniqueMediaItem>> {
    const history = await db.watchHistory.findMany({
        select: {
            title: true,
            year: true,
            mediaType: true,
            ratingKey: true,
            grandparentTitle: true,
            grandparentRatingKey: true
        },
        distinct: ['ratingKey', 'grandparentRatingKey']
    });

    const uniqueItems = new Map<string, UniqueMediaItem>();

    for (const entry of history) {
        if (entry.mediaType === 'movie' && entry.ratingKey && entry.title) {
            if (!uniqueItems.has(entry.ratingKey)) {
                uniqueItems.set(entry.ratingKey, {
                    title: entry.title,
                    year: entry.year || undefined,
                    type: 'movie',
                    ratingKey: entry.ratingKey
                });
            }
        } else if (entry.mediaType === 'episode' && entry.grandparentRatingKey && entry.grandparentTitle) {
            if (!uniqueItems.has(entry.grandparentRatingKey)) {
                uniqueItems.set(entry.grandparentRatingKey, {
                    title: entry.grandparentTitle,
                    year: undefined,
                    type: 'series',
                    ratingKey: entry.grandparentRatingKey
                });
            }
        }
    }

    return uniqueItems;
}
