import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

const PLEX_PRODUCT = 'RePlex';
const PLEX_CLIENT_ID = 'replex-web-client'; // Static or generated per server instance

export async function POST() {
    try {
        // 1. Request Pin
        const headers = {
            'X-Plex-Product': PLEX_PRODUCT,
            'X-Plex-Client-Identifier': PLEX_CLIENT_ID,
            'Accept': 'application/json'
        };

        const res = await fetch('https://plex.tv/api/v2/pins?strong=true', {
            method: 'POST',
            headers
        });

        if (!res.ok) throw new Error('Failed to contact Plex.tv');

        const data = await res.json();

        // data contains { id, code, ... }

        // 2. Construct Auth URL
        const authUrl = `https://app.plex.tv/auth#?clientID=${PLEX_CLIENT_ID}&code=${data.code}&context[device][product]=${PLEX_PRODUCT}`;

        return NextResponse.json({
            id: data.id,
            code: data.code,
            url: authUrl
        });

    } catch (error: any) {
        console.error("Plex Init Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
