import db from '../db';
import { Prisma } from '@prisma/client';

export interface StatsResult {
    totalDuration: string;
    totalSeconds: number;

    topShows: { title: string; duration: number }[];
    lazyDay: {
        winner: { day: string; hours: number };
        chartData: { day: string; short: string; hours: number }[];
    };
    activityType: {
        winner: string;
        description: string;
        breakdown: { label: string; value: number }[];
    };
    oldestMovie?: { title: string; year: number };
    oldestShow?: { title: string; year: number };
    longestBreak?: { title: string; days: number };
    mediaTypeSplit: { movies: number; shows: number };
    topShowByEpisodes?: { title: string; count: number };

    // Phase 6 Additions
    yourStan?: { actor: string; count: number; time: number; titles: string[]; imageUrl?: string }[];
    genreWheel: { genre: string; percentage: number }[];
    timeTraveler: { decade: string; count: number };
    averageYear: number;
    totalBandwidth: number;
    bingeRecord?: { show: string; count: number; date: string };
    techStats: {
        totalDataGB: number;
        transcodePercent: number;
        topPlatforms: { platform: string; count: number }[];
    };
    commitmentIssues: { count: number; titles: string[] };
    aiSummary?: string;
    valueProposition?: number;
    pirateBayValue?: number;
    comparison: {
        you: { seconds: number; label: string };
        average: { seconds: number; label: string };
        top: { seconds: number; label: string };
        bottom: { seconds: number; label: string };
        leaderboard: { label: string; seconds: number; isYou: boolean }[];
    };
}

export async function getStats(userId: number, year?: number, from?: Date, to?: Date, options: { forceRefresh?: boolean } = {}): Promise<StatsResult> {
    if (!year) year = new Date().getFullYear();
    const startDate = from || new Date(year, 0, 1);
    const endDate = to || new Date(year + 1, 0, 1);

    // 0. Cache Check
    // Only check cache if usage matches standard year/range (simplification for now)
    // If specific range dates are passed, we might skip cache or need smarter cache keys.
    // For now, assuming cache is for the "Standard View" (Current Year / Default).
    // Actually, the user object holds ONE cache string. It probably represents the "Main Dashboard" view.

    const aiConfig = await db.aiConfig.findFirst();

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

    // 1. Existing Stats (Condensed)
    const splitAgg = await db.watchHistory.groupBy({
        by: ['mediaType'],
        where,
        _sum: { duration: true, fileSize: true }
    });

    let movieSeconds = 0;
    let showSeconds = 0;
    let totalBandwidth = 0;

    splitAgg.forEach(c => {
        const s = c._sum.duration || 0;
        const size = Number(c._sum.fileSize || 0); // BigInt to Number (safe for display, might lose precision for petabytes but fine here)

        if (c.mediaType === 'movie') movieSeconds += s;
        else if (c.mediaType === 'episode') showSeconds += s;

        totalBandwidth += size;
    });
    const totalSeconds = movieSeconds + showSeconds;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const totalDuration = `${hours}h ${minutes}m`;



    // Simplification: removed topShows as requested
    const topShows: { title: string; duration: number }[] = [];

    const oldestMovieRaw = await db.watchHistory.findFirst({ where: { ...where, mediaType: 'movie', year: { not: null, gt: 1800 } }, orderBy: { year: 'asc' }, select: { title: true, year: true } });
    const oldestShowRaw = await db.watchHistory.findFirst({ where: { ...where, mediaType: 'episode', year: { not: null, gt: 1800 } }, orderBy: { year: 'asc' }, select: { grandparentTitle: true, year: true } });

    // 2. Your Stan (Top Actor)
    // Actors are CSV string. We need to fetch all strings and process in JS.
    const allActorsRaw = await db.watchHistory.findMany({
        where: { ...where, actors: { not: null } },
        select: { actors: true, mediaType: true, title: true, grandparentTitle: true, duration: true }
    });

    const actorProjects: Record<string, Set<string>> = {};
    const actorDuration: Record<string, number> = {};

    allActorsRaw.forEach(row => {
        if (!row.actors) return;
        const projectName = row.mediaType === 'episode' ? (row.grandparentTitle || row.title) : row.title; // Fallback to title if grandparent missing for episode
        const duration = row.duration || 0;

        row.actors.split(',').forEach(a => {
            const actor = a.trim();
            if (actor) {
                if (!actorProjects[actor]) actorProjects[actor] = new Set();
                actorProjects[actor].add(projectName);

                // Add duration
                actorDuration[actor] = (actorDuration[actor] || 0) + duration;
            }
        });
    });

    let yourStan: { actor: string; count: number; time: number; titles: string[]; imageUrl?: string }[] = [];
    const sortedActors = Object.entries(actorProjects)
        .map(([actor, projects]) => ({
            actor,
            count: projects.size,
            time: actorDuration[actor] || 0,
            titles: Array.from(projects).sort()
        }))
        .sort((a, b) => b.count - a.count);

    if (sortedActors.length > 0) {
        yourStan = sortedActors.slice(0, 5);

        // Fetch Images from TMDB if key exists
        const mediaConfig = await db.mediaConfig.findFirst();
        if (mediaConfig?.tmdbApiKey) {
            console.log("Fetching actor images from TMDB...");
            for (const stan of yourStan) {
                try {
                    const searchRes = await fetch(`https://api.themoviedb.org/3/search/person?query=${encodeURIComponent(stan.actor)}&api_key=${mediaConfig.tmdbApiKey}`);
                    if (searchRes.ok) {
                        const data = await searchRes.json();
                        if (data.results && data.results.length > 0) {
                            const person = data.results[0];
                            if (person.profile_path) {
                                stan.imageUrl = `https://image.tmdb.org/t/p/w185${person.profile_path}`;
                            }
                        }
                    }
                } catch (e) {
                    console.error(`Failed to fetch image for ${stan.actor}`, e);
                }
            }
        }
    }

    // 3. Genre Wheel
    const allGenresRaw = await db.watchHistory.findMany({
        where: { ...where, genres: { not: null } },
        select: { genres: true }
    });

    const genreCounts: Record<string, number> = {};
    let totalGenreTags = 0;
    allGenresRaw.forEach(row => {
        if (!row.genres) return;
        row.genres.split(',').forEach(g => {
            const genre = g.trim();
            if (genre) {
                genreCounts[genre] = (genreCounts[genre] || 0) + 1;
                totalGenreTags++;
            }
        });
    });

    const genreWheel = Object.entries(genreCounts)
        .map(([genre, count]) => ({ genre, percentage: Math.round((count / totalGenreTags) * 100) }))
        .sort((a, b) => b.percentage - a.percentage)
        .slice(0, 5); // Top 5

    // 4. Time Traveler (Decades)
    const decadesRaw = await db.watchHistory.findMany({
        where: { ...where, year: { not: null } },
        select: { year: true }
    });

    const decadeCounts: Record<string, number> = {};
    decadesRaw.forEach(r => {
        if (!r.year) return;
        const decade = Math.floor(r.year / 10) * 10;
        const key = `${decade}s`;
        decadeCounts[key] = (decadeCounts[key] || 0) + 1;
    });

    const sortedDecades = Object.entries(decadeCounts).sort((a, b) => b[1] - a[1]);
    const timeTraveler = sortedDecades.length > 0 ? { decade: sortedDecades[0][0], count: sortedDecades[0][1] } : { decade: "N/A", count: 0 };

    // 4b. Your Media Age (Average Year)
    const totalYears = decadesRaw.reduce((sum, r) => sum + (r.year || 0), 0);
    const averageYear = decadesRaw.length > 0 ? Math.round(totalYears / decadesRaw.length) : new Date().getFullYear();

    // 5. Tech Stats
    const techRaw = await db.watchHistory.aggregate({
        where,
        _sum: { fileSize: true },
        _count: { transcodeDecision: true } // just count rows
    });

    // Transcode %
    const transcodeCount = await db.watchHistory.count({
        where: { ...where, transcodeDecision: 'transcode' }
    });
    const totalPlays = await db.watchHistory.count({ where });
    const transcodePercent = totalPlays > 0 ? Math.round((transcodeCount / totalPlays) * 100) : 0;

    // Top Platforms
    const platformsRaw = await db.watchHistory.groupBy({
        by: ['player'],
        where: { ...where, player: { not: null } },
        _count: { player: true },
        orderBy: { _count: { player: 'desc' } },
        take: 5
    });
    const topPlatforms = platformsRaw.map(p => ({
        platform: p.player || "Unknown",
        count: p._count.player
    }));

    const totalDataGB = techRaw._sum.fileSize ? Math.round(Number(techRaw._sum.fileSize) / (1024 * 1024 * 1024)) : 0;

    // 6. Commitment Issues < 20%
    // 6. Commitment Issues < 20%
    const uncommittedRaw = await db.watchHistory.findMany({
        where: { ...where, percentComplete: { lt: 20 }, mediaType: 'movie' },
        select: { title: true },
        take: 50 // Cap at 50 to prevent overflow
    });
    const uncommittedCount = await db.watchHistory.count({
        where: { ...where, percentComplete: { lt: 20 }, mediaType: 'movie' }
    });
    const uncommittedTitles = uncommittedRaw.map(u => u.title);

    // 7. Binge Logic (Streak)
    // Logic: Same show, within 20 mins of each other
    // Need raw history ordered by date
    const episodes = await db.watchHistory.findMany({
        where: { ...where, mediaType: 'episode', grandparentRatingKey: { not: null } },
        orderBy: { date: 'asc' },
        select: { date: true, grandparentTitle: true, duration: true }
    });

    let maxStreak = 0;
    let currentStreak = 1;
    let bingeShow = "";
    let bingeDate = "";

    for (let i = 1; i < episodes.length; i++) {
        const prev = episodes[i - 1];
        const curr = episodes[i];

        // Check if same show
        if (prev.grandparentTitle === curr.grandparentTitle && prev.grandparentTitle) {
            // Check time gap. Did 'curr' start within 20 mins of 'prev' ending?
            // prev End = prev.date + prev.duration (secs) * 1000
            const prevEndCalls = prev.date.getTime() + (prev.duration * 1000);
            const gap = curr.date.getTime() - prevEndCalls;
            // 20 mins = 20 * 60 * 1000 = 1,200,000 ms
            if (gap >= 0 && gap < 1200000) {
                currentStreak++;
            } else {
                if (currentStreak > maxStreak) {
                    maxStreak = currentStreak;
                    bingeShow = prev.grandparentTitle;
                    bingeDate = prev.date.toDateString();
                }
                currentStreak = 1;
            }
        } else {
            if (currentStreak > maxStreak) {
                maxStreak = currentStreak;
                bingeShow = prev.grandparentTitle || "";
                bingeDate = prev.date.toDateString();
            }
            currentStreak = 1;
        }
    }
    // Check last loop
    if (currentStreak > maxStreak && episodes.length > 0) {
        maxStreak = currentStreak;
        bingeShow = episodes[episodes.length - 1].grandparentTitle || "";
        bingeDate = episodes[episodes.length - 1].date.toDateString();
    }

    const bingeRecord = maxStreak > 1 ? { show: bingeShow, count: maxStreak, date: bingeDate } : undefined;

    // ... (Old Lazy Day / Activity Type Logic - Keeping it same or condensed)
    // Re-using previous blocks...

    const lazyDayRaw = await db.$queryRaw<{ day: string, total: bigint | number }[]>`
        SELECT strftime('%w', date / 1000, 'unixepoch') as day, SUM(duration) as total
        FROM WatchHistory
        WHERE userId = ${userId}
        AND date >= ${startDate.getTime()}
        AND date < ${endDate.getTime()}
        GROUP BY day
        ORDER BY total DESC
    `;

    // Process Full Chart Data for Lazy Day
    const dayOfWeekMap = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const dayShortMap = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    // Initialize all days to 0
    const dayData = Array(7).fill(0).map((_, i) => ({ day: dayOfWeekMap[i], short: dayShortMap[i], hours: 0 }));

    lazyDayRaw.forEach(r => {
        const idx = parseInt(r.day);
        const total = Number(r.total);
        if (dayData[idx]) {
            dayData[idx].hours = Math.round(total / 3600);
        }
    });

    // Find Winner
    const sortedDays = [...dayData].sort((a, b) => b.hours - a.hours);

    // Rotate dayData so Monday is first (index 0 of result)
    // Current: 0=Sun, 1=Mon, ..., 6=Sat
    // Target: Mon, Tue, Wed, Thu, Fri, Sat, Sun
    const rotatedChartData = [
        ...dayData.slice(1), // Mon-Sat
        dayData[0]           // Sun
    ];

    const lazyDay = {
        winner: { day: sortedDays[0].day, hours: sortedDays[0].hours },
        chartData: rotatedChartData
    };

    // ... Activity Type ...
    const hourlyRaw = await db.$queryRaw<{ hour: string, total: bigint | number }[]>`
        SELECT strftime('%H', date / 1000, 'unixepoch') as hour, SUM(duration) as total
        FROM WatchHistory
        WHERE userId = ${userId}
        AND date >= ${startDate.getTime()}
        AND date < ${endDate.getTime()}
        GROUP BY hour
        ORDER BY total DESC
    `;
    let night = 0, morning = 0, day = 0;
    hourlyRaw.forEach((r: any) => {
        const h = parseInt(r.hour);
        const val = Number(r.total);
        if (h >= 5 && h < 11) morning += val;
        else if (h >= 11 && h < 22) day += val;
        else night += val;
    });

    // Calculate Percentages
    const totalHours = (night + morning + day) || 1; // Avoid div by 0
    const mornPct = morning / totalHours;
    const dayPct = day / totalHours;
    const nightPct = night / totalHours;

    let vibe = "The Casual Viewer";
    let vibeDesc = "A little bit of everything.";

    const DOMINANT_THRESHOLD = 0.50;
    const BALANCED_VARIANCE = 0.15;
    const MORN_THRESHOLD = 0.40;

    const maxPct = Math.max(mornPct, dayPct, nightPct);
    const minPct = Math.min(mornPct, dayPct, nightPct);

    // Logic Implementation
    if ((maxPct - minPct) < BALANCED_VARIANCE) {
        vibe = "The Zen Master";
        vibeDesc = "Perfect harmony. You watch content when you want, without bias.";
    } else if (nightPct > DOMINANT_THRESHOLD) {
        vibe = "The Vampire";
        vibeDesc = "The sun is your enemy. Screen time increases as the world goes dark.";
    } else if (dayPct > DOMINANT_THRESHOLD) {
        vibe = "The Daydreamer";
        vibeDesc = "You max out your entertainment while the sun is up.";
    } else if (mornPct > MORN_THRESHOLD) {
        vibe = "The Early Bird";
        vibeDesc = "Cartoons with cereal? You start your day with a play button.";
    } else {
        // Fallback for "Casual Viewer" but with dynamic text
        if (dayPct > nightPct) {
            vibe = "The Daytime Dweller";
            vibeDesc = "You prefer the light, but you aren't afraid of the dark.";
        } else {
            vibe = "The Night Owl";
            vibeDesc = "You lean towards the evening, but aren't fully nocturnal yet.";
        }
    }

    const activityType = {
        winner: vibe,
        description: vibeDesc,
        breakdown: [
            { label: 'Morning', value: morning }, // 5am - 11am
            { label: 'Day', value: day },         // 11am - 10pm
            { label: 'Night', value: night }      // 10pm - 5am
        ]
    };

    // ... Longest Break ...
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

    // --- AI SUMMARY GENERATION ---
    let aiSummary = undefined;

    const hasData = totalSeconds > 0;

    // Check if we need to generate AI:
    // 1. Enabled & Key exists
    // 2. AND (Force Refresh OR Cache matched but lacked summary)
    // Note: If we are here, we are either force refreshing OR we fell through from the cache check because summary was missing.
    // So we can just check if enabled.

    if (aiConfig?.enabled && aiConfig.apiKey && (hasData || options.forceRefresh)) {
        console.log("Generating AI Summary...");
        try {
            const OpenAI = require("openai");
            const openai = new OpenAI({ apiKey: aiConfig.apiKey });

            const statsContext = {
                user: { id: userId, year },
                totalDuration,
                lazyDay,
                vibe: activityType,
                stan: yourStan, // Send all top 3
                genreWheel,
                binge: bingeRecord,
                commitmentIssues: { count: uncommittedCount, titles: uncommittedTitles }, // Send titles too
                tech: { data: totalDataGB, transcodes: transcodePercent, platforms: topPlatforms },
                timeTraveler,
                longestBreak,
                topShowByEpisodes
            };

            const systemPrompt = aiConfig.instructions || "Analyze the user’s Plex statistics and produce a brutally honest /r/roastme-style roast. Be mean, dry, and sarcastic. No empathy, no disclaimers, no praise unless it is immediately undercut. Treat the stats as evidence of bad habits, questionable taste, avoidance of sleep, commitment issues, nostalgia addiction, or fake “good taste.” If data is missing, infer something unflattering. Write one or two short paragraphs that summarize the user as a person based solely on their viewing behavior. No emojis, no self-reference, no moral lessons. Roast choices and habits only, not protected traits. The result should be funny, uncomfortable, and very shareable.";

            const completion = await openai.chat.completions.create({
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: `Here are the user's stats for the year: ${JSON.stringify(statsContext)}. Write a short summary paragraph.` }
                ],
                model: aiConfig.model || "gpt-4o",
            });

            aiSummary = completion.choices[0].message.content;
        } catch (e: any) {
            console.error("AI Generation Failed", e.message);
            aiSummary = "AI Summary unavailable (Error generated).";
        }
    }

    // 8. Value Proposition
    // Formula: (Movies * $12) + ((TV_Hours / 10) * $15.49)
    // 10 hours of TV ~ 1 month of streaming value?
    // Cost per movie: ~$12 (Blu-ray/Digital Purchase)
    // Cost per TV month: ~$15.49 (Standard Netflix)
    // assumption: Avg TV season is 10 hours.

    // Count exact number of movies watched (regardless of finish state, or maybe just > 0 duration?)
    // Using topMoviesRaw counts only >1 plays. We need total movie count.
    const uniqueMoviesCount = await db.watchHistory.groupBy({ // This is just counting rows really if grouped by ID, duplicate plays?
        by: ['ratingKey'],
        where: { ...where, mediaType: 'movie' }
    });
    // Distinct movies played
    const movieCount = uniqueMoviesCount.length;

    const tvHours = showSeconds / 3600;

    const movieValue = movieCount * 12.00;
    const tvValue = (tvHours / 10.0) * 15.49;
    const totalValue = Math.round(movieValue + tvValue);

    // 9. Pirate Bay Value (The "Find Out" Phase)
    // US Statutory damages for willful infringement: up to $150,000 per work.
    // This is the "High Score" of legal penalties.
    const uniqueEpisodesCount = await db.watchHistory.groupBy({
        by: ['ratingKey'],
        where: { ...where, mediaType: 'episode' }
    });
    const episodeCount = uniqueEpisodesCount.length;
    const pirateBayValue = (movieCount + episodeCount) * 150000;

    // 10. Tier Logic
    const GOD_TIER = [
        "The Server Load", "Vitamin D Deficient", "The Retina Burner", "Premium Bandwidth Hog",
        "CEO of Binging", "The Electricity Bill", "Couch Fossil", "The 4K Connoisseur",
        "No Life Detected", "The Main Character"
    ];
    const HIGH_TIER = [
        "The Binge-Watcher", "Content Sommelier", "Professional Procrastinator", "Sleep Deprived",
        "The Marathon Runner", "Remote Control Dictator", "Subtitle Scholar", "WiFi Warrior",
        "Pixel Perfect", "The Introvert"
    ];
    const MID_TIER = [
        "The Normie", "Casual Friday", "The 'Just One Episode' Liar", "Healthy Social Life (Sarcastically)",
        "The NPC", "Weekend Warrior", "Background Noise Expert", "The 720p Enjoyer",
        "Buffer Buddy", "Average Joe"
    ];
    const LOW_TIER = [
        "The Tourist", "Touching Grass", "The Monthly Login", "Forgotten Password",
        "The Guest Account", "Are You Still Watching?", "The Trailer Watcher",
        "Dial-Up Survivor", "The Lurker", "Participation Trophy"
    ];
    const FREELOADER_TIER = [
        "The Freeloader", "Waste of a Seat", "Plex Pass Denier", "The Ghost",
        "Who Is This?", "Bandwidth Savior", "Log In, Log Out", "The Myth",
        "404 User Not Found", "Lowest of Them All"
    ];

    const pickName = (list: string[]) => list[Math.floor(Math.random() * list.length)];

    // 9. Comparison Logic (Phase 7) - Leaderboard
    const comparison = {
        you: { seconds: totalSeconds, label: "You" },
        average: { seconds: 0, label: "Average" },
        top: { seconds: 0, label: "Top" },
        bottom: { seconds: 0, label: "Bottom" },
        leaderboard: [] as { label: string; seconds: number; isYou: boolean }[]
    };

    try {
        // 1. Fetch ALL users first (to handle those with 0 history)
        const allUsers = await db.user.findMany({
            select: { id: true, username: true }
        });

        // 2. Fetch Aggregated Duration for the period
        const durations = await db.watchHistory.groupBy({
            by: ['userId'],
            where: {
                date: { gte: startDate, lt: endDate }
            },
            _sum: { duration: true }
        });

        // 3. Map Durations
        const durationMap: Record<number, number> = {};
        durations.forEach(d => {
            durationMap[d.userId] = d._sum.duration || 0;
        });

        let grandTotal = 0;
        const leaderboard = allUsers.map(u => {
            const seconds = durationMap[u.id] || 0;
            grandTotal += seconds;
            return {
                id: u.id, // Needed for deterministic random seeding
                label: u.username || `User ${u.id}`,
                seconds,
                isYou: u.id === userId
            };
        });

        // Sort descending
        leaderboard.sort((a, b) => b.seconds - a.seconds);

        // Assign Anonymized Names based on Rank/Tier
        const grandTotalSeconds = grandTotal; // Capture total for average calc

        const finalLeaderboard = leaderboard.map((item, index) => {
            // 1. Identification
            if (item.isYou) return { label: "You", seconds: item.seconds, isYou: true };

            // 2. Anonymization Logic
            let list = MID_TIER;
            const pct = 1 - (index / leaderboard.length); // 1.0 (Top) -> 0.0 (Bottom)

            if (item.seconds === 0) {
                list = FREELOADER_TIER;
            } else if (pct >= 0.9) {
                list = GOD_TIER;
            } else if (pct >= 0.70) {
                list = HIGH_TIER;
            } else if (pct >= 0.25) {
                list = MID_TIER;
            } else {
                list = LOW_TIER;
            }

            // Deterministic Name Selection (User ID + Index to avoid collisions for same ID in different years/contexts mostly)
            // Using index helps spread the names out if we simply iterated the list, but using ID keeps it stable for the user.
            // Let's use ID for stability.
            const name = list[item.id % list.length];

            // Check for duplicates? For now, collisions are funny. "The Normie" vs "The Normie".
            return { label: name, seconds: item.seconds, isYou: false };
        });

        // Stats
        const count = finalLeaderboard.length;
        const avg = count > 0 ? Math.round(grandTotalSeconds / count) : 0;
        const top = finalLeaderboard[0] || { label: "None", seconds: 0 };
        const bottom = finalLeaderboard[finalLeaderboard.length - 1] || { label: "None", seconds: 0 };

        comparison.average.seconds = avg;
        comparison.top = { seconds: top.seconds, label: top.label };
        comparison.bottom = { seconds: bottom.seconds, label: bottom.label };
        comparison.leaderboard = finalLeaderboard;

    } catch (e) {
        console.error("Comparison calc failed", e);
    }

    const result: StatsResult = {
        totalDuration, totalSeconds, topShows, lazyDay, activityType,
        oldestMovie: oldestMovieRaw ? { title: oldestMovieRaw.title, year: oldestMovieRaw.year! } : undefined,
        oldestShow: oldestShowRaw ? { title: oldestShowRaw.grandparentTitle!, year: oldestShowRaw.year! } : undefined,
        longestBreak, mediaTypeSplit: { movies: movieSeconds, shows: showSeconds }, topShowByEpisodes,
        yourStan,
        genreWheel,
        timeTraveler,
        averageYear,
        totalBandwidth,
        bingeRecord,
        techStats: { totalDataGB, transcodePercent, topPlatforms },
        commitmentIssues: { count: uncommittedCount, titles: uncommittedTitles },
        aiSummary,
        valueProposition: totalValue,
        pirateBayValue: pirateBayValue,
        comparison
    };

    // Cache the result
    /*
       We blindly save to statsCache.
       NOTE: If getStats is called with specific dates (not default), we overwrite the "main" cache.
       This is a known limitation of this simple implementation. 
       Ideally, we'd cache based on params, but for this specific app (annual wrap), 
       it usually just shows the 'current' wrap. 
    */
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
    let count = 0;
    const total = users.length;

    if (onProgress) onProgress(`INFO: Starting generation for ${total} users...`);

    for (const user of users) {
        count++;
        const progress = Math.round((count / total) * 100);
        if (onProgress) onProgress(`GENERATING: [${count}/${total}] ${user.username || 'User ' + user.id} (${progress}%)`);

        try {
            await getStats(user.id, undefined, undefined, undefined, { forceRefresh: true });
        } catch (e: any) {
            if (onProgress) onProgress(`ERROR: Failed for ${user.username}: ${e.message}`);
        }
    }
    if (onProgress) onProgress(`INFO: Generation Complete!`);
}
