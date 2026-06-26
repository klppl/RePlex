import db from '../../db';
import { fetchLibraries } from '../tautulli';

/**
 * Total movies / series / episodes available on the server (not per-user).
 * Reads live from Tautulli's get_libraries; returns undefined if Tautulli is
 * unreachable so stat generation still succeeds.
 */
export async function computeLibraryStats(): Promise<{ movies: number; shows: number; episodes: number } | undefined> {
    try {
        const config = await db.tautulliConfig.findFirst();
        if (!config) return undefined;

        const libraries = await fetchLibraries(config);

        let movies = 0;
        let shows = 0;
        let episodes = 0;

        for (const lib of libraries) {
            const count = Number(lib.count) || 0;
            if (lib.section_type === 'movie') {
                movies += count;
            } else if (lib.section_type === 'show') {
                shows += count;
                episodes += Number(lib.child_count) || 0;
            }
        }

        return { movies, shows, episodes };
    } catch (e) {
        console.error('Failed to compute library stats', e);
        return undefined;
    }
}
