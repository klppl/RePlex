import db from '../db';
import { fetchMetadata } from './tautulli';

interface OmdbResponse {
    Title: string;
    Year: string;
    Rated: string;
    Released: string;
    Runtime: string;
    Genre: string;
    Director: string;
    Writer: string;
    Actors: string;
    Plot: string;
    Language: string;
    Country: string;
    Awards: string;
    Poster: string;
    Ratings: { Source: string; Value: string }[];
    Metascore: string;
    imdbRating: string;
    imdbVotes: string;
    imdbID: string;
    Type: string;
    Response: string;
    Error?: string;
}

export async function fetchOmdbMetadata(title: string, year: number | undefined, type: 'movie' | 'series', apiKey: string, imdbId?: string): Promise<OmdbResponse | null> {
    try {
        const url = new URL('https://www.omdbapi.com/');
        url.searchParams.set('apikey', apiKey);

        if (imdbId) {
            url.searchParams.set('i', imdbId);
        } else {
            url.searchParams.set('t', title);
            if (year) url.searchParams.set('y', year.toString());
            url.searchParams.set('type', type);
        }

        const res = await fetch(url.toString());
        if (!res.ok) return null;

        const data = await res.json() as OmdbResponse;
        return data; // Fix missing return
    } catch (e) {
        console.error("OMDb Fetch Error:", e);
        return null;
    }
}

export async function syncOmdbData(onProgress?: (msg: string) => Promise<void>) {
    const config = await db.mediaConfig.findFirst();
    const tautulliConfig = await db.tautulliConfig.findFirst();

    if (!config || !config.omdbApiKey) {
        if (onProgress) await onProgress('ERROR: OMDb API Key not configured.');
        return;
    }
    if (!tautulliConfig) {
        if (onProgress) await onProgress('ERROR: Tautulli not configured.');
        return;
    }

    // 1. Get unique Movies and TV Shows from History
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

    // Manual filtering for unique items
    const uniqueItems = new Map<string, { title: string, year?: number, type: 'movie' | 'series', ratingKey: string }>();

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
            // For episodes, we want the SHOW metadata (grandparent)
            if (!uniqueItems.has(entry.grandparentRatingKey)) {
                uniqueItems.set(entry.grandparentRatingKey, {
                    title: entry.grandparentTitle,
                    year: undefined, // Series year is tricky from episode, omitted for now
                    type: 'series',
                    ratingKey: entry.grandparentRatingKey
                });
            }
        }
    }

    // 2. Filter out already cached items
    const existing = await db.mediaMetadata.findMany({
        select: { ratingKey: true }
    });
    const existingKeys = new Set(existing.map(e => e.ratingKey));

    const toFetch = Array.from(uniqueItems.values()).filter(i => !existingKeys.has(i.ratingKey));

    if (toFetch.length === 0) {
        if (onProgress) await onProgress('INFO: No new items to fetch.');
        return;
    }

    if (onProgress) await onProgress(`INFO: Found ${toFetch.length} new items to fetch.`);

    // 3. Fetch in batches (Limit to 950 to utilize almost full daily key quota of 1000)
    const BATCH_LIMIT = 950;
    const processList = toFetch.slice(0, BATCH_LIMIT);

    if (onProgress) await onProgress(`INFO: Processing batch of ${processList.length} items (Rate Limit Protection: Max 950/run).`);

    let successCount = 0;
    let failCount = 0;

    for (const item of processList) {
        if (onProgress) await onProgress(`FETCHING: ${item.title} (${item.type})...`);

        // Small delay to be nice to API
        await new Promise(r => setTimeout(r, 200));

        let imdbId: string | undefined;

        // Try to get IMDb ID from Tautulli
        try {
            // Log the attempt
            if (onProgress) await onProgress(`DEBUG: Asking Tautulli for metadata (ratingKey: ${item.ratingKey})...`);

            const metadata = await fetchMetadata(tautulliConfig, item.ratingKey);
            if (metadata) {
                // Tautulli (Plex) GUID structure can be messy.
                // 1. Check 'guids' array (if it exists)
                // 2. Check root 'guid' string

                const guids: { id: string }[] = [];

                if (Array.isArray(metadata.guids)) {
                    // Safe copy, filter out invalid entries
                    metadata.guids.forEach((g: any) => {
                        if (g && typeof g.id === 'string') guids.push({ id: g.id });
                    });
                }

                if (typeof metadata.guid === 'string') {
                    guids.push({ id: metadata.guid });
                }

                if (onProgress) await onProgress(`DEBUG: Tautulli Metadata for ${item.title}: RootGUID=${metadata.guid}, GUIDsArray=${metadata.guids ? metadata.guids.length : 0}`);

                // Try to find IMDb ID
                // Looking for 'imdb://tt...' or just 'tt...' in any ID
                const imdbEntry = guids.find(g => g.id.includes('imdb') || g.id.includes('tt'));

                if (imdbEntry) {
                    // Extract tt-id. Logic: look for 'tt' followed by digits
                    const match = imdbEntry.id.match(/(tt\d+)/);
                    if (match) imdbId = match[1];
                } else {
                    if (onProgress) await onProgress(`DEBUG: No IMDb/tt ID found in GUIDs for ${item.title}. Dump: ${JSON.stringify(guids)}`);
                }
            } else {
                if (onProgress) await onProgress(`DEBUG: Tautulli returned NO metadata for ${item.title} (Key: ${item.ratingKey})`);
            }
        } catch (e: any) {
            // Ignore Tautulli fetch errors, fall back to title
            if (onProgress) await onProgress(`DEBUG: Error fetching Tautulli metadata: ${e.message}`);
        }

        if (imdbId && onProgress) await onProgress(`  -> Found IMDb ID: ${imdbId} via Tautulli`);

        const data = await fetchOmdbMetadata(item.title, item.year, item.type, config.omdbApiKey, imdbId);

        if (data) {
            // Parse Ratings
            const rtString = data.Ratings.find(r => r.Source === 'Rotten Tomatoes')?.Value;
            const rt = rtString ? parseInt(rtString.replace('%', '')) : null;

            await db.mediaMetadata.create({
                data: {
                    ratingKey: item.ratingKey,
                    title: item.title,
                    type: item.type,
                    imdbId: data.imdbID !== 'N/A' ? data.imdbID : null,
                    ratingImdb: data.imdbRating !== 'N/A' ? parseFloat(data.imdbRating) : null, // Fix field name
                    ratingRtCritic: rt, // Fixed field name and type
                    poster: data.Poster !== 'N/A' ? data.Poster : null,
                    omdbResponse: JSON.stringify(data)
                }
            });
            successCount++;
        } else {
            failCount++;
            if (onProgress) await onProgress(`WARN: Not found or empty response for ${item.title}`);
        }
    }

    if (onProgress) await onProgress(`DONE: Processed ${processList.length} items. Success: ${successCount}, Failed: ${failCount}.`);
}
