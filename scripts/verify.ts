import db from '../lib/db';
import { checkConnection, syncUsers } from '../lib/services/tautulli';

// Mock fetch globally for Node environment
const originalFetch = global.fetch;

// @ts-ignore
global.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const urlStr = input.toString();
    console.log(`[MockFetch] ${urlStr}`);

    if (urlStr.includes('cmd=status')) {
        return new Response(JSON.stringify({
            response: { result: 'success', message: null, data: {} }
        }));
    }

    if (urlStr.includes('cmd=get_users')) {
        return new Response(JSON.stringify({
            response: {
                result: 'success',
                message: null,
                data: [
                    { user_id: 101, username: 'Alice', email: 'alice@example.com', user_thumb: 'alice.jpg', is_active: 1 },
                    { user_id: 102, username: 'Bob', email: 'bob@example.com', user_thumb: 'bob.jpg', is_active: 0 }
                ]
            }
        }));
    }

    return new Response("Not Found", { status: 404 });
}

async function main() {
    console.log("Starting Verification...");

    // 1. Setup Config
    console.log("Seeding config...");
    await db.tautulliConfig.upsert({
        where: { id: 1 },
        update: { ip: 'localhost', port: 8181, apiKey: 'test_key', useSsl: false },
        create: { ip: 'localhost', port: 8181, apiKey: 'test_key', useSsl: false }
    });

    const config = await db.tautulliConfig.findFirstOrThrow();

    // 2. Test Connection
    console.log("Testing connection...");
    const connected = await checkConnection(config);
    if (connected) console.log("✅ Connection Successful");
    else console.error("❌ Connection Failed");

    // 3. Test Sync
    console.log("Syncing users...");
    const count = await syncUsers();
    console.log(`✅ Synced ${count} users`);

    // 4. Verify DB
    const users = await db.user.findMany({ orderBy: { id: 'asc' } });
    console.log("Users in DB:", JSON.stringify(users, null, 2));

    if (users.length === 2 && users[0].username === 'Alice') {
        console.log("✅ Verification Passed!");
    } else {
        console.error("❌ Verification Failed: DB state incorrect");
        process.exit(1);
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => db.$disconnect());
