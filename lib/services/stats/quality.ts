import db from '../../db';
import { Prisma } from '@prisma/client';

const PERSONAS = [
    {
        min: 90, options: [
            { t: "The Certified Fresh \u{1F345}", d: "You trust critics blindly. Have you ever had an original thought, or do you wait for Rotten Tomatoes to tell you what to think?" },
            { t: "The Film Snob \u{1F9D0}", d: "Only masterpieces will do. Your library looks like the syllabus for a film studies degree. Boring, but impressive." }
        ]
    },
    {
        min: 80, options: [
            { t: "The Curator \u{1F3DB}\uFE0F", d: "You have taste, we'll give you that. You separate the wheat from the chaff, but you miss out on the charm of a truly terrible action movie." },
            { t: "The Oscar Bait \u{1F3C6}", d: "It seems you only watch movies trying to win awards. Do you cry at everything, or are you just pretending?" }
        ]
    },
    {
        min: 70, options: [
            { t: "The Mainstream Connoisseur \u{1F37F}", d: "You like good stuff, but you aren't afraid to dig in the bargain bin occasionally. A healthy balance between art and entertainment." },
            { t: "The Crowd Pleaser \u{1F91D}", d: "Your taste is like a perfect party playlist \u2013 no one complains, but no one is surprised either. You are safety personified." }
        ]
    },
    {
        min: 60, options: [
            { t: "The 'It's Fine' Enthusiast \u{1F937}", d: "You don't turn it off even if it's lukewarm. Your standard is: 'Does it move? Does it have sound? Okay, let's go.'" },
            { t: "The Time Killer \u231B", d: "You don't seek quality, you seek distraction. Your average score screams 'I had nothing else to do'." }
        ]
    },
    {
        min: 50, options: [
            { t: "The Coin Flipper \u{1FA99}", d: "Half gold, half trash. Checking your history is like Russian Roulette \u2013 you never know if you'll get a classic or a headache." },
            { t: "The Tolerance Tester \u{1F4C9}", d: "You have an impressive pain threshold. For every good movie you see, you punish yourself with two bad ones. Why?" }
        ]
    },
    {
        min: 40, options: [
            { t: "The Guilty Pleasure \u{1FAE3}", d: "We don't judge you. Or well, a little. But we assume you watch all of this 'ironically'? Right? Please say yes." },
            { t: "The B-Movie Baron \u{1F3AC}", d: "Budget doesn't seem to be your thing. You prefer movies where the boom mic is in the shot and actors read directly from the script." }
        ]
    },
    {
        min: 20, options: [
            { t: "The Trash Panda \u{1F99D}", d: "You dig in the trash can and find... trash. But you seem to like it. It's a talent to find this much dung." },
            { t: "The Cinematic Masochist \u26D3\uFE0F", d: "You torture yourself through things that make others cut ties. Do you seek help, or do you like the pain?" }
        ]
    },
    {
        min: 0, options: [
            { t: "The Razzies Juror \u{1F5D1}\uFE0F", d: "Your top list is the rest of the world's bottom list. Either you're trolling the algorithm, or you hate your eyes." },
            { t: "System Failure \u26A0\uFE0F", d: "We didn't think it was mathematically possible to have taste this bad. Congratulations, you beat the system." }
        ]
    }
];

export async function computeQuality(where: Prisma.WatchHistoryWhereInput, userId: number) {
    let highestRatedMovie;
    let lowestRatedMovie;
    let highestRatedShow;
    let lowestRatedShow;
    let averageQualityScore = 0;

    try {
        // Get robust list of all ratingKeys involved in history for this year
        const distinctKeys = await db.watchHistory.findMany({
            where: where,
            select: { ratingKey: true, grandparentRatingKey: true, mediaType: true },
            distinct: ['ratingKey']
        });

        const movieKeys = new Set<string>();
        const showKeys = new Set<string>();

        distinctKeys.forEach(k => {
            if (k.mediaType === 'movie' && k.ratingKey) movieKeys.add(k.ratingKey);
            if (k.mediaType === 'episode' && k.grandparentRatingKey) showKeys.add(k.grandparentRatingKey);
        });

        const allKeys = [...Array.from(movieKeys), ...Array.from(showKeys)];

        if (allKeys.length > 0) {
            const metadata = await db.mediaMetadata.findMany({
                where: { ratingKey: { in: allKeys }, unifiedScore: { not: null } },
                select: { ratingKey: true, title: true, type: true, unifiedScore: true, poster: true }
            });

            if (metadata.length > 0) {
                // Calculate Average
                const totalScore = metadata.reduce((sum, item) => sum + (item.unifiedScore || 0), 0);
                averageQualityScore = Math.round(totalScore / metadata.length);

                // Split Movie/TV
                const movies = metadata.filter(m => m.type === 'movie');
                const shows = metadata.filter(m => m.type === 'series');

                // Find Highest/Lowest
                if (movies.length > 0) {
                    movies.sort((a, b) => (b.unifiedScore || 0) - (a.unifiedScore || 0));
                    highestRatedMovie = { title: movies[0].title, score: movies[0].unifiedScore!, poster: movies[0].poster };
                    lowestRatedMovie = { title: movies[movies.length - 1].title, score: movies[movies.length - 1].unifiedScore!, poster: movies[movies.length - 1].poster };
                }

                if (shows.length > 0) {
                    shows.sort((a, b) => (b.unifiedScore || 0) - (a.unifiedScore || 0));
                    highestRatedShow = { title: shows[0].title, score: shows[0].unifiedScore!, poster: shows[0].poster };
                    lowestRatedShow = { title: shows[shows.length - 1].title, score: shows[shows.length - 1].unifiedScore!, poster: shows[shows.length - 1].poster };
                }
            }
        }

    } catch (e) {
        console.error("Quality Stats Failed", e);
    }

    // Generate Persona
    let personaTitle = "The Unknowable";
    let personaDescription = "Not enough data to judge you yet. You're safe... for now.";

    if (averageQualityScore > 0) {
        const s = averageQualityScore;
        const lowestTitle = lowestRatedMovie?.title || lowestRatedShow?.title || "that one weird movie";

        const match = PERSONAS.find(p => s >= p.min);
        if (match) {
            // Deterministic random based on UserId to keep persona consistent for the user
            const index = userId % match.options.length;
            const p = match.options[index];
            personaTitle = p.t;
            personaDescription = `${p.d} And we will never forget that you watched "${lowestTitle}".`;
        }
    }

    return {
        average: averageQualityScore,
        highestMovie: highestRatedMovie,
        lowestMovie: lowestRatedMovie,
        highestShow: highestRatedShow,
        lowestShow: lowestRatedShow,
        persona: { title: personaTitle, description: personaDescription }
    };
}
