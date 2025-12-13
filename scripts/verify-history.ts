
import db from '../lib/db';
import { syncHistoryForUser } from '../lib/services/sync';
import { addDays } from 'date-fns';

// Mock fetch globally
// @ts-ignore
const originalFetch = global.fetch;
global.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url_str = input.toString();
    console.log(`[MockFetch] ${url_str} `);

    if (url_str.includes('cmd=get_metadata')) {
        return {
            ok: true,
            json: async () => ({
                response: {
                    result: 'success',
                    data: {
                        actors: ['Test Actor'],
                        genres: ['Test Genre'], // Tautulli can return strings directly or objects
                        rating: 8.5,
                        media_info: [{ parts: [{ file_size: '1000000' }] }]
                    }
                }
            })
        } as any;
    }

    if (url_str.includes('cmd=get_history')) {
        // Extract start_date from URL
        const url = new URL(url_str);
        const startDate = url.searchParams.get('start_date');

        // Simulate data for that specific day
        const entries = [];
        if (startDate) {
            // Create an entry for 12:00 PM on that day
            const timestamp = new Date(`${startDate} T12:00:00Z`).getTime() / 1000;
            entries.push({
                date: timestamp,
                row_id: timestamp, // pseudo unique
                title: `Movie on ${startDate} `,
                media_type: 'movie',
                duration: 3600,
                percent_complete: 100,
                user_id: 101, // Alice
                user_thumb: 'alice.jpg',
                rating_key: 101 // Added rating_key to trigger metadata fetch
            });
        }

        return new Response(JSON.stringify({
            response: {
                result: 'success',
                message: null,
                data: { data: entries }
            }
        }));
    }

    if (url_str.includes('cmd=status')) {
        return new Response(JSON.stringify({ response: { result: 'success' } }));
    }

    return new Response("Not Found", { status: 404 });
}

async function main() {
    console.log("Starting History Sync Verification...");

    // 1. Ensure User & Clean Data
    await db.syncLog.deleteMany({ where: { userId: 101 } });
    await db.watchHistory.deleteMany({ where: { userId: 101 } });

    await db.user.upsert({
        where: { id: 101 },
        update: {},
        create: { id: 101, username: 'Alice', isActive: true }
    });

    // 2. Ensure Config
    await db.tautulliConfig.upsert({
        where: { id: 1 },
        update: { ip: 'localhost', port: 8181, apiKey: 'test_key', useSsl: false },
        create: { ip: 'localhost', port: 8181, apiKey: 'test_key', useSsl: false }
    });

    // 3. Sync Range: Jan 1 to Jan 3
    const from = new Date('2023-01-01');
    const to = new Date('2023-01-03');

    console.log("--- First Sync Run ---");
    const result1 = await syncHistoryForUser(101, from, to);
    console.log("First Run Result:", result1); // Should match 3 days (Jan 1, 2, 3) if they are in past

    // 4. Verify DB
    const count = await db.watchHistory.count();
    console.log(`DB Count: ${count} `);
    const logs = await db.syncLog.count();
    console.log(`Sync Logs: ${logs} `);

    // 5. Second Sync Run (Should skip cached)
    console.log("--- Second Sync Run (Should skip) ---");
    // We assume 'now' is much later so these dates are considered 'past/complete'
    const result2 = await syncHistoryForUser(101, from, to);
    console.log("Second Run Result:", result2);

    if (result1.syncedDays === 3 && result2.syncedDays === 0) {
        console.log("✅ Verification Passed: syncs correctly and caches results.");
    } else {
        console.error("❌ Verification Failed!");
        process.exit(1);
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => db.$disconnect());
