import db from '../../db';

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

export async function computeLeaderboard(
    userId: number, totalSeconds: number, startDate: Date, endDate: Date,
    anonymize: boolean
) {
    const comparison = {
        you: { seconds: totalSeconds, label: "You" },
        average: { seconds: 0, label: "Average" },
        top: { seconds: 0, label: "Top" },
        bottom: { seconds: 0, label: "Bottom" },
        leaderboard: [] as { label: string; seconds: number; isYou: boolean }[]
    };

    try {
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

            // 2. Check Anonymization Setting
            if (!anonymize) {
                return { label: item.label, seconds: item.seconds, isYou: false };
            }

            // 3. Anonymization Logic
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

            // Deterministic Name Selection
            const name = list[item.id % list.length];
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

    return comparison;
}
