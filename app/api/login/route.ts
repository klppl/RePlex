import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function POST(request: Request) {
    return NextResponse.json({
        error: 'This authentication method is deprecated. Please use the secure Login Link provided by your administrator.'
    }, { status: 410 });
}
