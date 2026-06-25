import { NextResponse } from 'next/server';

export async function POST() {
    return NextResponse.json({
        error: 'This authentication method is deprecated. Please use the secure Login Link provided by your administrator.'
    }, { status: 410 });
}
