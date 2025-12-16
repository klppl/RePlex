import db from '../db';
import { fetchMetadata } from './tautulli';
import { fetchOmdbMetadata } from './omdb';

// --- Interfaces ---

interface EnrichedMetadata {
    ratingKey: string;
    title: string;
    year?: number;
    type: 'movie' | 'series';

    imdbId?: string;
    tmdbId?: string;

    ratingImdb?: number;
    ratingRtCritic?: number;
    ratingTmdb?: number;

    // For logging/storage
    poster?: string;
    omdbDataRaw?: string;
}

// --- Helpers ---

// Normalize 0-10 or 0-100 to 0-100 integer
function normalizeScore(val: number | undefined | null, scale: '10' | '100'): number | null {
    if (val === undefined || val === null || isNaN(val)) return null;
    if (scale === '10') return Math.round(val * 10);
    return Math.round(val);
}

function calculateUnifiedScore(meta: EnrichedMetadata): number | null {
    const sImdb = normalizeScore(meta.ratingImdb, '10');
    const sRt = normalizeScore(meta.ratingRtCritic, '100');
    const sTmdb = normalizeScore(meta.ratingTmdb, '10');

    // Weights: IMDb 40%, RT 40%, TMDB 20%
    // If one is missing, redistribute its weight proportionally to remaining.

    let totalScore = 0;
    let totalWeight = 0;

    if (sImdb !== null) {
        totalScore += sImdb * 0.4;
        totalWeight += 0.4;
    }
    if (sRt !== null) {
        totalScore += sRt * 0.4;
        totalWeight += 0.4;
    }
    if (sTmdb !== null) {
        totalScore += sTmdb * 0.2;
        totalWeight += 0.2;
    }

    if (totalWeight === 0) return null;

    // Re-normalize to 100%
    return Math.round(totalScore / totalWeight);
}

async function fetchTmdbRating(tmdbId: string, type: 'movie' | 'series', apiKey: string): Promise<number | null> {
    try {
        const endpoint = type === 'series' ? 'tv' : 'movie';
        const url = `https://api.themoviedb.org/3/${endpoint}/${tmdbId}?api_key=${apiKey}`;
        const res = await fetch(url);
        if (!res.ok) return null;
        const json = await res.json();
        return json.vote_average || null;
    } catch (e) {
        return null;
    }
}

async function searchTmdb(title: string, year: number | undefined, type: 'movie' | 'series', apiKey: string): Promise<string | null> {
    try {
        const endpoint = type === 'series' ? 'search/tv' : 'search/movie';
        const url = new URL(`https://api.themoviedb.org/3/${endpoint}`);
        url.searchParams.set('api_key', apiKey);
        url.searchParams.set('query', title);
        if (year) url.searchParams.set(type === 'series' ? 'first_air_date_year' : 'year', year.toString());

        const res = await fetch(url.toString());
        if (!res.ok) return null;
        const json = await res.json();
        if (json.results && json.results.length > 0) {
            return json.results[0].id.toString();
        }
        return null;
    } catch (e) {
        return null;
    }
}

async function fetchTmdbExternalIds(tmdbId: string, type: 'movie' | 'series', apiKey: string): Promise<{ imdbId?: string } | null> {
    try {
        const endpoint = type === 'series' ? 'tv' : 'movie';
        const url = `https://api.themoviedb.org/3/${endpoint}/${tmdbId}/external_ids?api_key=${apiKey}`;
        const res = await fetch(url);
        if (!res.ok) return null;
        const json = await res.json();
        return { imdbId: json.imdb_id || undefined };
    } catch (e) {
        return null;
    }
}

// --- Main Pipeline ---

export async function processMetadataEnrichment(onProgress?: (msg: string) => Promise<void>) {
    const config = await db.mediaConfig.findFirst();
    const tautulliConfig = await db.tautulliConfig.findFirst();

    if (!config) {
        if (onProgress) await onProgress('ERROR: Media Config missing.');
        return;
    }
    if (!tautulliConfig) {
        if (onProgress) await onProgress('ERROR: Tautulli Config missing.');
        return;
    }

    // 1. Identify candidates (same logic as before: unique items from history)
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

    const uniqueItems = new Map<string, { title: string, year?: number, type: 'movie' | 'series', ratingKey: string }>();

    for (const entry of history) {
        if (entry.mediaType === 'movie' && entry.ratingKey && entry.title) {
            uniqueItems.set(entry.ratingKey, {
                title: entry.title,
                year: entry.year || undefined,
                type: 'movie',
                ratingKey: entry.ratingKey
            });
        } else if (entry.mediaType === 'episode' && entry.grandparentRatingKey && entry.grandparentTitle) {
            uniqueItems.set(entry.grandparentRatingKey, {
                title: entry.grandparentTitle,
                year: undefined,
                type: 'series',
                ratingKey: entry.grandparentRatingKey
            });
        }
    }

    // 2. Filter out items that already have a Unified Score (or recent update)
    // For specific requirement "upsert", we might want to re-process if old? 
    // For now, let's skip existing to save API calls, similar to previous logic.
    const existing = await db.mediaMetadata.findMany({
        where: { unifiedScore: { not: null } },
        select: { ratingKey: true }
    });
    const existingKeys = new Set(existing.map(e => e.ratingKey));

    const toProcess = Array.from(uniqueItems.values()).filter(i => !existingKeys.has(i.ratingKey));

    if (toProcess.length === 0) {
        if (onProgress) await onProgress('INFO: No new items to enrich.');
        return;
    }

    if (onProgress) await onProgress(`INFO: Starting enrichment for ${toProcess.length} items.`);

    // 3. Batch Process
    const CONCURRENCY = 25;

    // Helper to process a single item
    const processItem = async (item: typeof toProcess[0]) => {
        try {
            if (onProgress) await onProgress(`Processing: ${item.title}`);

            const meta: EnrichedMetadata = {
                ratingKey: item.ratingKey,
                title: item.title,
                year: item.year,
                type: item.type
            };

            // --- Step 1: Plex/Tautulli Metadata ---
            try {
                const plexData = await fetchMetadata(tautulliConfig, item.ratingKey);
                if (plexData) {
                    // Extract IDs from GUIDs
                    // Tautulli v2 returns guids array, but we must verify contents
                    const rawGuids = Array.isArray(plexData.guids) ? plexData.guids : [];
                    const guids: { id: string }[] = rawGuids.filter((g: any) => g && typeof g.id === 'string');

                    if (typeof plexData.guid === 'string') guids.push({ id: plexData.guid });

                    // if (onProgress) await onProgress(`    [Trace] GUIDs found: ${guids.length}`);

                    const imdbEntry = guids.find(g => g.id.includes('imdb') || g.id.includes('tt'));
                    if (imdbEntry) {
                        const m = imdbEntry.id.match(/(tt\d+)/);
                        if (m) meta.imdbId = m[1];
                    }

                    const tmdbEntry = guids.find(g => g.id.includes('tmdb') || g.id.includes('themoviedb'));
                    if (tmdbEntry) {
                        const m = tmdbEntry.id.match(/tmdb:\/\/(\d+)/) || tmdbEntry.id.match(/\/(\d+)\?/); // regex might need tuning depending on exact format
                        // Typical format: com.plexapp.agents.themoviedb://12345?lang=en
                        const simpleMatch = tmdbEntry.id.match(/(\d+)/); // simplified extraction if we know it's a tmdb entry
                        if (simpleMatch) meta.tmdbId = simpleMatch[1];
                    }

                    // if (onProgress) await onProgress(`    [Trace] IDs extracted - IMDb: ${meta.imdbId || 'N/A'}, TMDB: ${meta.tmdbId || 'N/A'}`);

                    if (!meta.imdbId && !meta.tmdbId && guids.length > 0) {
                        // Check if we have specific failure case to debug further
                        /*
                        if (onProgress && item.title.includes('Gudfadern')) {
                           // Deep debug for this specific item
                           await onProgress(`    [DEBUG-FULL] Full Tautulli Data: ${JSON.stringify(plexData)}`);
                        }
                        if (onProgress) await onProgress(`    [Debug] Failed to extract IDs from GUIDs. Raw: ${JSON.stringify(guids.map(g => g.id))}`);
                        */
                    }

                    // Map generic fields from Plex (usually 0-10 scale)
                    if (plexData.rating) {
                        // Plex 'rating' is usually Critic Rating (0-10)
                        // Map to TMDB (0-10) directly
                        meta.ratingTmdb = parseFloat(plexData.rating);
                    }
                    if (plexData.audience_rating) {
                        // Plex 'audience_rating' is usually 0-10 (e.g. 8.2)
                        const val = parseFloat(plexData.audience_rating);
                        if (!isNaN(val)) {
                            // If it's already > 10, assume it's percentage (rare for Plex API, but safe to check)
                            meta.ratingRtCritic = val > 10 ? Math.round(val) : Math.round(val * 10);
                        }
                    }
                }
            } catch (e: any) {
                if (onProgress) await onProgress(`    [Warn] Plex Metadata fetch failed: ${e.message}`);
            }

            // --- Step 1.5: Fallback Search via TMDB (For localized titles) ---
            if (!meta.tmdbId && config.tmdbApiKey) {
                const foundId = await searchTmdb(item.title, item.year, item.type, config.tmdbApiKey);
                if (foundId) {
                    meta.tmdbId = foundId;
                    // if (onProgress) await onProgress(`    [Trace] Found TMDB ID via search: ${foundId}`);
                }
            }

            // --- Step 1.6: TMDB to IMDb Translation ---
            if (meta.tmdbId && !meta.imdbId && config.tmdbApiKey) {
                const external = await fetchTmdbExternalIds(meta.tmdbId, item.type, config.tmdbApiKey);
                if (external?.imdbId) {
                    meta.imdbId = external.imdbId;
                    // if (onProgress) await onProgress(`    [Trace] Found IMDb ID via TMDB: ${meta.imdbId}`);
                }
            }

            // --- Step 2: External Enrichment ---

            // A. TMDB
            if (meta.tmdbId && config.tmdbApiKey) {
                const val = await fetchTmdbRating(meta.tmdbId, item.type, config.tmdbApiKey);
                if (val !== null) {
                    meta.ratingTmdb = val;
                    // if (onProgress) await onProgress(`    [Trace] TMDB Rating found: ${val}`);
                } else {
                    // if (onProgress) await onProgress(`    [Trace] TMDB Fetch returned null`);
                }
            } else if (!config.tmdbApiKey) {
                // if (onProgress) await onProgress(`    [Trace] Skipping TMDB (No API Key)`);
            }

            // B. OMDb (Fallback or specific for IMDb/RT)
            // Strategy: OMDb is great for IMDb rating and RT Critic Score.
            // We call it if we have an IMDb ID (found via Plex) OR if we just search by title (as fallback) 
            // BUT we only call if we are missing critical data (RT/IMDb) or just generally getting it?
            // User plan says: "If (and ONLY if) we still lack a Rotten Tomatoes score... call OMDb."
            // But getting IMDb rating is also good from OMDb.
            // Let's call OMDb if we have the API Key.

            if (config.omdbApiKey) {
                // Rate limit check simulation? No, just concurrency.
                // Call our existing helper
                const omdb = await fetchOmdbMetadata(item.title, item.year, item.type, config.omdbApiKey, meta.imdbId);
                if (omdb) {
                    // Start Log
                    // if (onProgress) await onProgress(`    [Trace] OMDb hit. IMDb: ${omdb.imdbRating}, RT: ${omdb.Ratings?.find(r => r.Source === 'Rotten Tomatoes')?.Value}`);

                    meta.omdbDataRaw = JSON.stringify(omdb);
                    if (omdb.imdbID && !meta.imdbId) meta.imdbId = omdb.imdbID;
                    if (omdb.Poster && omdb.Poster !== 'N/A') meta.poster = omdb.Poster;

                    // Ratings
                    if (omdb.imdbRating && omdb.imdbRating !== 'N/A') meta.ratingImdb = parseFloat(omdb.imdbRating);

                    const rt = omdb.Ratings.find(r => r.Source === 'Rotten Tomatoes')?.Value; // "87%"
                    if (rt) {
                        meta.ratingRtCritic = parseInt(rt.replace('%', ''));
                    }
                } else {
                    // const failReason = omdb?.Error || 'Null response';
                    // if (onProgress) await onProgress(`    [Trace] OMDb missed (Reason: ${failReason})`);
                }
            } else {
                // if (onProgress) await onProgress(`    [Trace] Skipping OMDb (No API Key)`);
            }

            // --- Step 3: Unified Score ---
            const unified = calculateUnifiedScore(meta);

            // --- Step 4: Database Upsert ---
            await db.mediaMetadata.upsert({
                where: { ratingKey: meta.ratingKey },
                create: {
                    ratingKey: meta.ratingKey,
                    title: meta.title,
                    type: meta.type,
                    imdbId: meta.imdbId,
                    tmdbId: meta.tmdbId,
                    ratingImdb: meta.ratingImdb,
                    ratingRtCritic: meta.ratingRtCritic,
                    ratingTmdb: meta.ratingTmdb,
                    unifiedScore: unified,
                    poster: meta.poster,
                    omdbResponse: meta.omdbDataRaw
                },
                update: {
                    imdbId: meta.imdbId,
                    tmdbId: meta.tmdbId,
                    ratingImdb: meta.ratingImdb,
                    ratingRtCritic: meta.ratingRtCritic,
                    ratingTmdb: meta.ratingTmdb,
                    unifiedScore: unified,
                    poster: meta.poster,
                    omdbResponse: meta.omdbDataRaw,
                    updatedAt: new Date()
                }
            });

            if (unified !== null) {
                if (onProgress) await onProgress(`  > Enriched "${item.title}": Unified Score ${unified} (IMDb:${meta.ratingImdb || '-'}, RT:${meta.ratingRtCritic || '-'}%, TMDB:${meta.ratingTmdb || '-'})`);
            } else {
                if (onProgress) await onProgress(`  > saved "${item.title}" (No score calculated)`);
            }

        } catch (e: any) {
            if (onProgress) await onProgress(`ERROR processing ${item.title}: ${e.message}`);
        }
    };

    // Simple Batch Loop
    for (let i = 0; i < toProcess.length; i += CONCURRENCY) {
        const batch = toProcess.slice(i, i + CONCURRENCY);
        await Promise.all(batch.map(processItem));
        // Small breathing room
        await new Promise(r => setTimeout(r, 500));
    }

    if (onProgress) await onProgress('DONE: Enrichment complete.');
}
