import db from '../db';
import { TautulliConfig } from '@prisma/client';
import { format } from 'date-fns';

export interface TautulliUser {
    user_id: number;
    username: string;
    email: string;
    user_thumb: string;
    is_active?: boolean | number;
}

export interface TautulliHistoryEntry {
    date: number;
    row_id: number;
    id?: number;
    title: string;
    duration: number;
    percent_complete: number;
    media_type: string;
    parent_title?: string;
    grandparent_title?: string;
    full_title?: string; // Added
    rating_key?: number; // Changed type from number | string to number
    parent_rating_key?: number; // Changed type from number | string to number
    grandparent_rating_key?: number; // Changed type from number | string to number
    year?: number;
    thumb?: string;
    user_id: number;
    actors?: string[]; // Array of strings from Tautulli
    genres?: string[]; // Array of strings from Tautulli
    rating?: number; // Audience rating
    transcode_decision?: string; // 'transcode', 'direct play', 'copy'
    player?: string; // 'Chrome', 'Plex for Windows'
    file_size?: number; // Bytes
    [key: string]: any;
}

interface TautulliResponse<T> {
    response: {
        result: 'success' | 'failure';
        message: string | null;
        data: T;
    };
}

export function getTautulliUrl(config: TautulliConfig, cmd: string, params: Record<string, string> = {}): string {
    const protocol = config.useSsl ? 'https' : 'http';
    let root = config.rootPath || '';
    // Ensure root path starts with / and doesn't end with / if present
    if (root) {
        if (!root.startsWith('/')) root = '/' + root;
        if (root.endsWith('/')) root = root.slice(0, -1);
    }

    const url = new URL(`${protocol}://${config.ip}:${config.port}${root}/api/v2`);
    url.searchParams.set('apikey', config.apiKey);
    url.searchParams.set('cmd', cmd);
    for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
    }
    return url.toString();
}

export async function checkConnection(config: TautulliConfig): Promise<boolean> {
    try {
        const url = getTautulliUrl(config, 'status');
        const res = await fetch(url);
        if (!res.ok) return false;
        const json = await res.json() as TautulliResponse<any>;
        return json.response.result === 'success';
    } catch (e) {
        console.error("Tautulli connection check failed:", e);
        return false;
    }
}

export async function fetchUsers(config: TautulliConfig): Promise<TautulliUser[]> {
    const url = getTautulliUrl(config, 'get_users');
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch users: ${res.statusText}`);

    const json = await res.json() as TautulliResponse<TautulliUser[]>;
    if (json.response.result !== 'success') {
        throw new Error(`Tautulli API Error: ${json.response.message}`);
    }
    return json.response.data;
}

export async function syncUsers(): Promise<number> {
    const config = await db.tautulliConfig.findFirst();
    if (!config) throw new Error("No Tautulli configuration found");

    const users = await fetchUsers(config);

    let syncedCount = 0;
    for (const user of users) {
        // Tautulli API v2 typically returns is_active as 1 or 0
        const isActive = user.is_active === 1 || user.is_active === true;

        await db.user.upsert({
            where: { id: user.user_id },
            update: {
                username: user.username,
                email: user.email,
                thumb: user.user_thumb,
                isActive: isActive
            },
            create: {
                id: user.user_id,
                username: user.username,
                email: user.email,
                thumb: user.user_thumb,
                isActive: isActive
            }
        });
        syncedCount++;
    }
    return syncedCount;
}

export async function fetchHistory(
    config: TautulliConfig,
    userId: number | null,
    date: Date,
    length: number = 2000
): Promise<TautulliHistoryEntry[]> {
    // Using ASC order to iteration logic
    const startDateStr = format(date, 'yyyy-MM-dd');

    const params: Record<string, string> = {
        cmd: 'get_history',
        grouping: '1',
        include_activity: '0',
        start_date: startDateStr,
        length: length.toString(),
        order_column: 'date',
        order_dir: 'asc'
    };

    if (userId !== null) {
        params.user_id = userId.toString();
    }

    const url = getTautulliUrl(config, 'get_history', params);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch history: ${res.statusText}`);

    const json = await res.json() as TautulliResponse<any>;
    if (json.response.result !== 'success') {
        throw new Error(`Tautulli API Error: ${json.response.message}`);
    }

    const data = json.response.data;
    // If Tautulli returns { data: [] }
    if (data && Array.isArray(data.data)) return data.data;
    // If Tautulli returns []
    if (Array.isArray(data)) return data;

    return [];
}

export async function fetchMetadata(config: TautulliConfig, ratingKey: string): Promise<any> {
    const url = getTautulliUrl(config, 'get_metadata', { rating_key: ratingKey });
    try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const json = await res.json() as TautulliResponse<any>;
        return json.response.data;
    } catch (e) {
        console.error(`Failed to fetch metadata for ${ratingKey}`, e);
        return null;
    }
}
