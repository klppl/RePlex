import { getStats } from '../lib/services/stats';
import db from '../lib/db';

async function main() {
    console.log("Verifying Stats Engine...");

    // Clean up previous test data
    await db.watchHistory.deleteMany({ where: { userId: 999 } });
    await db.user.deleteMany({ where: { id: 999 } });

    // Create Seed Data
    console.log('Seeding test user 999...');
    await db.user.create({ data: { id: 999, username: 'TestUser', email: 'test@example.com' } });

    const now = new Date();
    await db.watchHistory.createMany({
        data: [
            // Oldest Show (1990)
            {
                userId: 999,
                date: new Date(now.getTime()),
                mediaType: 'episode',
                duration: 1800,
                title: 'Episode 1',
                grandparentTitle: 'Old Show',
                year: 1990,
                percentComplete: 100
            },
            // Replayed Movie (Watched 3 times)
            {
                userId: 999,
                date: new Date(now.getTime() - 10000),
                title: 'Replayed Movie',
                mediaType: 'movie',
                duration: 5000,
                year: 2020,
                percentComplete: 100,
            },
            {
                userId: 999,
                date: new Date(now.getTime() - 20000),
                title: 'Replayed Movie',
                mediaType: 'movie',
                duration: 5000,
                year: 2020,
                percentComplete: 100,
            },
            {
                userId: 999,
                date: new Date(now.getTime() - 30000),
                title: 'Replayed Movie',
                mediaType: 'movie',
                duration: 5000,
                year: 2020,
                percentComplete: 100,
            },
            // Single Watch Movie (Should NOT appear in top list)
            {
                userId: 999,
                date: new Date(now.getTime()),
                title: 'Once Movie',
                mediaType: 'movie',
                duration: 7200,
                year: 1999,
                percentComplete: 100,
            },
            // Another movie for unique actor check
            {
                userId: 999,
                date: new Date(now.getTime()),
                title: 'Cranston Movie',
                mediaType: 'movie',
                duration: 7200,
                year: 2022,
                percentComplete: 100,
                actors: "Bryan Cranston, Aaron Paul",
            },
            { userId: 999, date: new Date(now.getTime() - 86400000), duration: 3600, percentComplete: 100, mediaType: 'episode', year: 2020, title: 'Ep 1', grandparentTitle: 'Binge Show', fullTitle: 'Binge Show - S1E1', actors: 'Bryan Cranston', genres: 'Drama', fileSize: BigInt(2000000000), transcodeDecision: 'transcode', player: 'Android TV' },
            // Binge streak: same show, within 20 mins
            { userId: 999, date: new Date(now.getTime() - 86000000), duration: 3600, percentComplete: 100, mediaType: 'episode', year: 2020, title: 'Ep 2', grandparentTitle: 'Binge Show', fullTitle: 'Binge Show - S1E2', actors: 'Bryan Cranston, Aaron Paul', genres: 'Drama' },
            { userId: 999, date: new Date(now.getTime() - 85000000), duration: 3600, percentComplete: 100, mediaType: 'episode', year: 2020, title: 'Ep 3', grandparentTitle: 'Binge Show', fullTitle: 'Binge Show - S1E3', actors: 'Bryan Cranston', genres: 'Drama' },

            // Commitment Issues
            { userId: 999, date: new Date(now.getTime() - 200000000), duration: 1000, percentComplete: 10, mediaType: 'movie', title: 'Boring Movie', year: 2021, fullTitle: 'Boring Movie (2021)', actors: 'Unknown Actor', genres: 'Documentary' },
        ]
    });

    const userId = 999;
    const stats = await getStats(userId, new Date().getFullYear());

    console.log('Stats Result:', JSON.stringify(stats, null, 2));

    if (stats.totalSeconds >= 0 && Array.isArray(stats.topMovies)) {
        console.log("✅ Stats Engine returned valid structure.");
    } else {
        console.error("❌ Stats Engine returned invalid structure.");
    }
}

main()
    .catch(e => console.error(e))
    .finally(() => db.$disconnect());
