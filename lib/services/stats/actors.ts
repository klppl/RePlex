import db from '../../db';

export async function computeActors(allActorsRaw: { actors: string | null; mediaType: string; title: string; grandparentTitle: string | null; duration: number | null }[]) {
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

    return yourStan;
}
