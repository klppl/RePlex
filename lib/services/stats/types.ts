export interface StatsResult {
    totalDuration: string;
    totalSeconds: number;

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
    qualityStats?: {
        average: number;
        highestMovie?: { title: string; score: number; poster?: string | null };
        lowestMovie?: { title: string; score: number; poster?: string | null };
        highestShow?: { title: string; score: number; poster?: string | null };
        lowestShow?: { title: string; score: number; poster?: string | null };
        persona: { title: string; description: string };
    };
    hasSynced?: boolean;
}
