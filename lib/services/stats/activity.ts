import db from '../../db';

export async function computeActivity(userId: number, startDate: Date, endDate: Date) {
    // Lazy Day (day of week breakdown)
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

    // Activity Type (time of day breakdown)
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
    hourlyRaw.forEach((r) => {
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

    return { lazyDay, activityType };
}
