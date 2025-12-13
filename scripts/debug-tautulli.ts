
import db from '../lib/db';
import { getTautulliUrl } from '../lib/services/tautulli';

async function main() {
    const config = await db.tautulliConfig.findFirst();
    if (!config) {
        console.error("No Tautulli config found");
        return;
    }

    // specific call to get metadata
    const params = {
        rating_key: '101919', // Use the key we saw in history
        cmd: 'get_metadata',
    };

    const url = getTautulliUrl(config, 'get_metadata', { rating_key: '101919' });
    console.log("Fetching Metadata from:", url.replace(config.apiKey, 'API_KEY_HIDDEN'));

    try {
        const res = await fetch(url);
        const json = await res.json();
        console.log("Full Metadata Response:");
        console.log(JSON.stringify(json.response.data, null, 2));
    } catch (e) {
        console.error("Error:", e);
    }
}

main().finally(() => db.$disconnect());
