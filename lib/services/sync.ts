import { startOfDay, endOfDay, isSameDay, format, isToday, addDays, differenceInCalendarDays } from 'date-fns';
import db from '@/lib/db';
import { fetchHistory, fetchMetadata } from './tautulli';
import { StatsResult } from './stats';

export async function syncHistoryForUser(
    userId: number,
    fromDate: Date,
    toDate: Date,
    force = false,
    onProgress?: (msg: string) => void,
    signal?: AbortSignal
): Promise<{ syncedDays: number, totalEntries: number }> {
    const config = await db.tautulliConfig.findFirst();
    if (!config) {
        throw new Error('Tautulli configuration missing');
    }

    const start = startOfDay(fromDate);
    const end = startOfDay(toDate);

    let syncedDays = 0;
    let syncedCount = 0;
    let lastLoggedMonth = '';
    let totalEntries = 0;

    // Calculate total duration for progress
    const totalDays = differenceInCalendarDays(end, start) + 1;
    let daysProcessed = 0;
    let lastProgress = 0;

    // Loop through each day
    let currentDate = start;

    const startStr = format(start, 'yyyy-MM-dd');
    const endStr = format(end, 'yyyy-MM-dd');
    if (onProgress) onProgress(`INFO: Starting sync from ${startStr} to ${endStr}`);

    while (currentDate <= end) {
        if (signal?.aborted) {
            throw new Error('Sync operation aborted by user');
        }

        // Track Progress
        daysProcessed++;
        const currentProgress = Math.round((daysProcessed / totalDays) * 100);
        if (currentProgress >= lastProgress + 10) {
            if (onProgress) onProgress(`Progress: ${currentProgress}%`);
            lastProgress = currentProgress;
        }

        // Group logs by month
        const currentMonthStr = format(currentDate, 'MMMM yyyy');
        if (currentMonthStr !== lastLoggedMonth) {
            if (onProgress) onProgress(`Processing ${currentMonthStr}...`);
            lastLoggedMonth = currentMonthStr;
        }

        const isCurrentDateToday = isToday(currentDate);

        // 1. Check SyncLog
        // If force is true, we delete the log and proceed
        if (force) {
            await db.syncLog.deleteMany({
                where: {
                    userId,
                    date: currentDate
                }
            });
        }

        const cached = await db.syncLog.findUnique({
            where: {
                userId_date: {
                    userId,
                    date: currentDate
                }
            }
        });

        // Optimization: If cached and complete, skip (unless forcing refresh)
        if (cached && cached.completed && !force) {
            currentDate = addDays(currentDate, 1);
            continue;
        }

        // 2. Fetch from Tautulli
        try {
            const formattedDate = format(currentDate, 'yyyy-MM-dd');
            // if (onProgress) onProgress(`DEBUG: Fetching for ${formattedDate}`);

            const history = await fetchHistory(config as any, userId, currentDate);

            // 3. Process & Filter
            const validItems = [];
            const uniqueItemsToFetch = new Set<string>();
            const metadataCache: Record<string, any> = {};

            for (const h of history) {
                const hDate = new Date(h.date * 1000);
                if (isSameDay(hDate, currentDate)) {
                    validItems.push(h);
                    if (h.rating_key) uniqueItemsToFetch.add(h.rating_key.toString());
                } else {
                    // Debug filtering
                    // console.log(`[SYNC] Filtered out item date ${hDate.toISOString()} vs current ${currentDate.toISOString()}`);
                }
            }

            if (history.length > 0 && validItems.length === 0) {
                // Check if these are just adjacent day overlaps (timezone differences)
                const allAdjacent = history.every(h => {
                    const hDate = new Date(h.date * 1000);
                    return Math.abs(differenceInCalendarDays(hDate, currentDate)) <= 1;
                });

                if (!allAdjacent) {
                    const msg = `WARN: Found ${history.length} items for ${formattedDate} but filtered all!`;
                    if (onProgress) {
                        const hDate = new Date(history[0].date * 1000);
                        onProgress(`${msg} Sample: ${format(hDate, 'yyyy-MM-dd HH:mm')} vs Current: ${format(currentDate, 'yyyy-MM-dd HH:mm')}`);
                    }
                } else {
                    // Benign overlap, ignore or log debug
                    // console.log(`[SYNC] Ignored ${history.length} overlapping items for ${formattedDate}`);
                }
            }

            // Fetch metadata for unique items (Parallelized with concurrency limit)
            const uniqueKeys = Array.from(uniqueItemsToFetch);

            // OPTIMIZATION: Check local DB for existing metadata to avoid Tautulli hits
            // We look for any valid WatchHistory entry with this ratingKey that has filled metadata
            const missingKeys: string[] = [];

            // Check in chunks to avoid SQLite limits on "IN" clause
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

                // Map existing to cache
                for (const row of existingRows) {
                    if (row.ratingKey) {
                        // Reconstruct a partial meta object sufficient for insertion
                        metadataCache[row.ratingKey] = {
                            actors: row.actors ? row.actors.split(',') : [],
                            genres: row.genres ? row.genres.split(',').map(g => ({ tag: g })) : [],
                            rating: row.rating ? String(row.rating) : null,
                            media_info: row.fileSize ? [{ parts: [{ file_size: row.fileSize.toString() }] }] : []
                        };
                    }
                }
            }

            // Identify what's still missing
            for (const key of uniqueKeys) {
                if (!metadataCache[key]) {
                    missingKeys.push(key);
                }
            }

            if (onProgress && missingKeys.length > 0) {
                onProgress(`Metadata: Downloading ${missingKeys.length} new items (${uniqueKeys.length - missingKeys.length} found in cache)...`);
            }

            const BATCH_SIZE = 5; // Reduced from 10 to 5 to be gentler

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

                // Throttle: Sleep 500ms between batches
                await new Promise(r => setTimeout(r, 500));
            }

            // 4. Save
            await db.$transaction([
                db.watchHistory.deleteMany({
                    where: {
                        userId: userId,
                        date: {
                            gte: startOfDay(currentDate),
                            lte: endOfDay(currentDate)
                        }
                    }
                }),
                db.watchHistory.createMany({
                    data: validItems.map(h => {
                        const meta = h.rating_key ? metadataCache[h.rating_key.toString()] : null;
                        const actors = meta?.actors ? meta.actors.join(',') : null;
                        const genres = meta?.genres ? meta.genres.map((g: any) => typeof g === 'string' ? g : g.tag).join(',') : null; // Tautulli sometimes returns {tag: 'Drama'}
                        // Tautulli metadata response structure varies. Usually genres is array of strings or objects.
                        // Debug output showed "genres": [ "Komedi" ], so strings.

                        // File size
                        let fileSize = null;
                        if (meta && meta.media_info && meta.media_info[0] && meta.media_info[0].parts && meta.media_info[0].parts[0]) {
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
                    })
                })
            ]);

            totalEntries += validItems.length;

            // 5. Update SyncLog
            // If the date is "Today", do NOT mark it as complete
            if (!isCurrentDateToday) {
                await db.syncLog.upsert({
                    where: { userId_date: { userId, date: currentDate } },
                    update: { completed: true },
                    create: { userId, date: currentDate, completed: true }
                });
                syncedDays++;
            }
        } catch (e) {
            console.error(`Failed to sync date ${currentDate.toISOString()}`, e);
            // We continue to next day? Or throw? 
            // Better to throw or log error and stop? 
            // For now log and continue to try next days? 
            // No, getting history API failure usually means connection issue. Stop.
            throw e;
        }

        currentDate = addDays(currentDate, 1);
    }


    // Invalidate Cache after sync so stats are regenerated
    try {
        await db.user.update({
            where: { id: userId },
            data: { statsCache: null, statsGeneratedAt: null }
        });
        console.log(`[SYNC] Cleared stats cache for user ${userId}`);
    } catch (e) {
        console.error("Failed to clear stats cache", e);
    }

    return { syncedDays, totalEntries };
}

export async function syncGlobalHistory(
    fromDate: Date,
    toDate: Date,
    onProgress?: (msg: string) => void,
    signal?: AbortSignal
): Promise<{ syncedDays: number, totalEntries: number }> {
    const config = await db.tautulliConfig.findFirst();
    if (!config) {
        throw new Error('Tautulli configuration missing');
    }

    const start = startOfDay(fromDate);
    const end = startOfDay(toDate);

    let syncedDays = 0;
    let totalEntries = 0;
    let lastLoggedMonth = '';

    // Calculate total duration for progress
    const totalDays = differenceInCalendarDays(end, start) + 1;
    let daysProcessed = 0;
    let lastProgress = 0;
    const startTime = Date.now();

    // Fetch Active Users map
    const activeUsers = await db.user.findMany({ where: { isActive: true }, select: { id: true } });
    const activeUserSet = new Set(activeUsers.map(u => u.id));

    // Generate Date List
    const allDates: Date[] = [];
    let dt = start;
    while (dt <= end) {
        allDates.push(new Date(dt)); // Clone
        dt = addDays(dt, 1);
    }

    const startStr = format(start, 'yyyy-MM-dd');
    const endStr = format(end, 'yyyy-MM-dd');
    if (onProgress) onProgress(`INFO: Starting global sync from ${startStr} to ${endStr}`);

    // Process in Batches
    const CONCURRENCY = 10; // Lowered back to 10 to prevent SQLite timeouts

    for (let i = 0; i < allDates.length; i += CONCURRENCY) {
        if (signal?.aborted) throw new Error('Sync aborted');

        const batch = allDates.slice(i, i + CONCURRENCY);

        // Process Batch
        const results = await Promise.all(batch.map(async (currentDate) => {
            let entriesCount = 0;
            let success = false;

            try {
                // Determine Month for Logging (using first in batch or current)
                // We'll update main progress loop after batch.

                // Fetch Global History for Day
                const history = await fetchHistory(config as any, null, currentDate); // null user_id = global

                // Filter for Active Users
                const validItems = [];
                const uniqueItemsToFetch = new Set<string>();
                const metadataCache: Record<string, any> = {};

                for (const h of history) {
                    const hDate = new Date(h.date * 1000);
                    if (isSameDay(hDate, currentDate)) {
                        if (activeUserSet.has(h.user_id)) {
                            validItems.push(h);
                            if (h.rating_key) uniqueItemsToFetch.add(h.rating_key.toString());
                        }
                    }
                }

                // Fetch metadata for unique items
                const uniqueKeys = Array.from(uniqueItemsToFetch);

                // Local Cache Check
                const missingKeys: string[] = [];
                const CHECK_BATCH = 100;
                for (let j = 0; j < uniqueKeys.length; j += CHECK_BATCH) {
                    const chunk = uniqueKeys.slice(j, j + CHECK_BATCH);
                    const existingRows = await db.watchHistory.findMany({
                        where: { ratingKey: { in: chunk }, NOT: { actors: null, genres: null } },
                        select: { ratingKey: true, actors: true, genres: true, rating: true, fileSize: true }
                    });
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

                for (const key of uniqueKeys) {
                    if (!metadataCache[key]) missingKeys.push(key);
                }

                const META_BATCH = 5; // Reduced from 25 to 5

                for (let j = 0; j < missingKeys.length; j += META_BATCH) {
                    const mb = missingKeys.slice(j, j + META_BATCH);
                    await Promise.all(mb.map(async (key) => {
                        try {
                            const meta = await fetchMetadata(config, key);
                            if (meta) metadataCache[key] = meta;
                        } catch (err) { }
                    }));
                    await new Promise(r => setTimeout(r, 500)); // Sleep
                }

                // Transaction: Delete & Insert
                if (validItems.length > 0) {
                    await db.watchHistory.deleteMany({
                        where: {
                            userId: { in: Array.from(activeUserSet) },
                            date: {
                                gte: startOfDay(currentDate),
                                lte: endOfDay(currentDate)
                            }
                        }
                    });

                    await db.watchHistory.createMany({
                        data: validItems.map(h => {
                            const meta = h.rating_key ? metadataCache[h.rating_key.toString()] : null;
                            const actors = meta?.actors ? meta.actors.join(',') : null;
                            const genres = meta?.genres ? meta.genres.map((g: any) => typeof g === 'string' ? g : g.tag).join(',') : null;

                            let fileSize = null;
                            if (meta?.media_info?.[0]?.parts?.[0]) {
                                fileSize = BigInt(meta.media_info[0].parts[0].file_size);
                            }

                            return {
                                userId: h.user_id,
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
                        })
                    });
                    entriesCount = validItems.length;
                }

                // Update SyncLog - Optimized for SQLite (Bulk delete + insert instead of N upserts)
                const isCurrentDateToday = isSameDay(currentDate, new Date());
                if (!isCurrentDateToday) {
                    // Use a transaction to ensure atomicity for the log update
                    await db.$transaction([
                        db.syncLog.deleteMany({
                            where: {
                                userId: { in: activeUsers.map(u => u.id) },
                                date: currentDate
                            }
                        }),
                        db.syncLog.createMany({
                            data: activeUsers.map(u => ({
                                userId: u.id,
                                date: currentDate,
                                completed: true
                            }))
                        })
                    ]);
                }

                success = true;
            } catch (e) {
                console.error(`Failed to global sync date ${currentDate.toISOString()}`, e);
            }
            return { success, entriesCount };
        }));

        // Update Totals & Progress
        results.forEach(r => {
            if (r.success) syncedDays++;
            totalEntries += r.entriesCount;
        });

        daysProcessed += batch.length;
        const currentProgress = Math.round((daysProcessed / totalDays) * 100);

        if (currentProgress > lastProgress) {
            if (onProgress) onProgress(`PROGRESS: ${currentProgress}%`);
            lastProgress = currentProgress;
        }

        // Log Month Change based on last item in batch
        const lastBatchDate = batch[batch.length - 1];
        const currentMonthStr = format(lastBatchDate, 'MMMM yyyy');
        if (currentMonthStr !== lastLoggedMonth) {
            if (onProgress) onProgress(`MONTH_START:${currentMonthStr}`);
            lastLoggedMonth = currentMonthStr;
        }
    }

    // Clear caches for all Active Users
    await db.user.updateMany({
        where: { id: { in: Array.from(activeUserSet) } },
        data: { statsCache: null, statsGeneratedAt: null }
    });

    return { syncedDays, totalEntries };
}
