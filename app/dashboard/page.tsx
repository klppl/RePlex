import { getStats } from '@/lib/services/stats';
import { StatCard } from '../components/StatCard';
import { Metadata } from 'next';
import DashboardClient from './DashboardClient';
import db from '@/lib/db'; // Import DB to check cache status

export const metadata: Metadata = {
    title: 'Tautulli Wrapped',
    description: 'Your year in review',
};

// Next.js 15+ searchParams might be a Promise, but in 14 it's direct, 
// unless using "Dynamic Rendering".
// We will treat this as a Server Component.
import { headers } from 'next/headers';

import { verifyAdminSession } from '@/lib/auth-admin';

export default async function DashboardPage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    const resolvedSearchParams = await searchParams;
    let userId = resolvedSearchParams['userId'] ? Number(resolvedSearchParams['userId']) : null;
    const year = resolvedSearchParams['year'] ? Number(resolvedSearchParams['year']) : new Date().getFullYear();

    // Check headers from middleware (SSO)
    const headerList = await headers();
    const headerId = headerList.get('x-user-id');
    const adminSession = await verifyAdminSession();

    if (headerId) {
        if (!adminSession) {
            // Fix IDOR: If logged in as User and NOT Admin, FORCE own stats.
            userId = Number(headerId);
        } else if (!userId) {
            // If Admin but no param, default to self if applicable
            userId = Number(headerId);
        }
    }

    if (!userId) {
        // If not logged in and no param, redirect to login? Or show form?
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
                <div className="text-center">
                    <h1 className="text-white text-2xl mb-4">Please Log In</h1>
                    <a href="/" className="text-emerald-400 hover:text-emerald-300 underline">Go to Login</a>
                </div>
            </div>
        );
    }

    // Check Cache Status First
    let initialStats = null;
    let shouldGenerate = false;

    try {
        const user = await db.user.findUnique({
            where: { id: userId },
            select: { statsCache: true }
        });

        if (user?.statsCache) {
            // Fast Path: Cache exists, load it
            initialStats = await getStats(userId, year);
        } else {
            // Slow Path: Needs generation
            shouldGenerate = true;
        }

    } catch (e) {
        console.error("Failed to check cache or fetch stats", e);
        // Fallback to error UI handled in Client or here
    }

    return (
        <DashboardClient initialStats={initialStats} userId={userId} year={year} shouldGenerate={shouldGenerate} />
    );
}
