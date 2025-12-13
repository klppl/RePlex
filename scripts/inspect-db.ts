
import db from '../lib/db';

async function main() {
    const history = await db.watchHistory.findMany({
        where: { userId: 999 }
    });
    console.log(JSON.stringify(history, null, 2));
}

main();
