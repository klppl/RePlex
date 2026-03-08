import db from '@/lib/db';
import { fetchMetadata } from './tautulli';
import { TautulliHistoryEntry } from './tautulli';

export function mapHistoryItem(
    h: TautulliHistoryEntry,
    metadataCache: Record<string, any>,
    userId: number
) {
    const meta = h.rating_key ? metadataCache[h.rating_key.toString()] : null;
    const actors = meta?.actors ? meta.actors.join(',') : null;
    const genres = meta?.genres ? meta.genres.map((g: any) => typeof g === 'string' ? g : g.tag).join(',') : null;

    let fileSize = null;
    if (meta?.media_info?.[0]?.parts?.[0]) {
        fileSize = BigInt(meta.media_info[0].parts[0].file_size);
    }

    return {
        userId,
        tautulliId: h.row_id || h.id,
        date: new Date(h.date * 1000),
        duration: h.duration ? parseInt(String(h.duration), 10) : 0,
        percentComplete: h.percent_complete ? parseInt(String(h.percent_complete), 10) : 0,
        mediaType: h.media_type,
        year: h.year ? parseInt(String(h.year), 10) : null,
        title: h.title,
        parentTitle: h.parent_title,
        grandparentTitle: h.grandparent_title,
        ratingKey: h.rating_key?.toString(),
        parentRatingKey: h.parent_rating_key?.toString(),
        grandparentRatingKey: h.grandparent_rating_key?.toString(),
        fullTitle: h.full_title,
        actors: actors,
        genres: genres,
        rating: meta?.rating ? Number(meta.rating) : (meta?.audience_rating ? Number(meta.audience_rating) : null),
        transcodeDecision: h.transcode_decision,
        player: h.player,
        fileSize: fileSize,
    };
}

export async function fetchMissingMetadata(
    uniqueKeys: string[],
    config: any,
    metadataCache: Record<string, any>,
    signal?: AbortSignal,
    onProgress?: (msg: string) => void
): Promise<void> {
    const missingKeys: string[] = [];

    // Check local DB in chunks of 100 for existing metadata
    const CHECK_BATCH = 100;
    for (let i = 0; i < uniqueKeys.length; i += CHECK_BATCH) {
        const chunk = uniqueKeys.slice(i, i + CHECK_BATCH);
        const existingRows = await db.watchHistory.findMany({
            where: {
                ratingKey: { in: chunk },
                NOT: {
                    actors: null,
                    genres: null
                }
            },
            select: {
                ratingKey: true,
                actors: true,
                genres: true,
                rating: true,
                fileSize: true
            }
        });

        // Reconstruct partial meta objects from existing DB rows
        for (const row of existingRows) {
            if (row.ratingKey) {
                metadataCache[row.ratingKey] = {
                    actors: row.actors ? row.actors.split(',') : [],
                    genres: row.genres ? row.genres.split(',').map(g => ({ tag: g })) : [],
                    rating: row.rating ? String(row.rating) : null,
                    media_info: row.fileSize ? [{ parts: [{ file_size: row.fileSize.toString() }] }] : []
                };
            }
        }
    }

    // Identify still-missing keys
    for (const key of uniqueKeys) {
        if (!metadataCache[key]) {
            missingKeys.push(key);
        }
    }

    if (onProgress && missingKeys.length > 0) {
        onProgress(`Metadata: Downloading ${missingKeys.length} new items (${uniqueKeys.length - missingKeys.length} found in cache)...`);
    }

    // Batch-fetch missing from Tautulli in batches of 5
    const BATCH_SIZE = 5;
    for (let i = 0; i < missingKeys.length; i += BATCH_SIZE) {
        if (signal?.aborted) throw new Error('Sync aborted');

        const batch = missingKeys.slice(i, i + BATCH_SIZE);

        await Promise.all(batch.map(async (key) => {
            try {
                const meta = await fetchMetadata(config, key);
                if (meta) {
                    metadataCache[key] = meta;
                }
            } catch (err) {
                // ignore individual metadata failures
            }
        }));

        // 500ms sleep between batches
        await new Promise(r => setTimeout(r, 500));
    }
}
