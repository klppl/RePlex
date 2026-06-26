import db from '../../db';

interface PopularityRow {
    title: string;
    users: number | bigint;
    plays: number | bigint;
}

export interface GlobalPopularity {
    movies: { title: string; users: number; plays: number }[];
    shows: { title: string; users: number; plays: number }[];
}

/**
 * Server-wide popularity: movies and series ranked by how many DISTINCT users
 * watched them in the period (ties broken by total plays). Identical for every
 * user, so it's recomputed per generation but reflects the whole community.
 */
export async function computePopularity(startDate: Date, endDate: Date): Promise<GlobalPopularity> {
    const start = startDate.getTime();
    const end = endDate.getTime();

    const [movieRows, showRows] = await Promise.all([
        db.$queryRaw<PopularityRow[]>`
            SELECT COALESCE(NULLIF(title, ''), 'Unknown') as title,
                   COUNT(DISTINCT userId) as users,
                   COUNT(*) as plays
            FROM WatchHistory
            WHERE mediaType = 'movie' AND ratingKey IS NOT NULL
              AND date >= ${start} AND date < ${end}
            GROUP BY ratingKey
            ORDER BY users DESC, plays DESC
            LIMIT 10
        `,
        db.$queryRaw<PopularityRow[]>`
            SELECT COALESCE(NULLIF(grandparentTitle, ''), 'Unknown') as title,
                   COUNT(DISTINCT userId) as users,
                   COUNT(*) as plays
            FROM WatchHistory
            WHERE mediaType = 'episode' AND grandparentRatingKey IS NOT NULL
              AND date >= ${start} AND date < ${end}
            GROUP BY grandparentRatingKey
            ORDER BY users DESC, plays DESC
            LIMIT 10
        `,
    ]);

    const normalize = (rows: PopularityRow[]) => rows.map(r => ({
        title: r.title,
        users: Number(r.users),
        plays: Number(r.plays),
    }));

    return { movies: normalize(movieRows), shows: normalize(showRows) };
}
