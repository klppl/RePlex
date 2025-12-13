import { getStats } from '@/lib/services/stats';
import { StatCard } from '../components/StatCard';
import { Metadata } from 'next';
import DashboardClient from './DashboardClient';

export const metadata: Metadata = {
    title: 'Tautulli Wrapped',
    description: 'Your year in review',
};

// Next.js 15+ searchParams might be a Promise, but in 14 it's direct, 
// unless using "Dynamic Rendering".
// We will treat this as a Server Component.
import { headers } from 'next/headers';

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
    if (!userId && headerId) {
        userId = Number(headerId);
    }

    if (!userId) {
        // If not logged in and no param, redirect to login? Or show form?
        // User requested SSO login. Redirect to home if no user.
        // Actually home is login page now.
        // We can just link back to home.
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
                <div className="text-center">
                    <h1 className="text-white text-2xl mb-4">Please Log In</h1>
                    <a href="/" className="text-emerald-400 hover:text-emerald-300 underline">Go to Login</a>
                </div>
            </div>
        );
    }

    // Fetch Stats directly on server
    let stats;
    try {
        stats = await getStats(userId, year);
    } catch (e) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 text-white">
                <div className="bg-red-900/50 p-6 rounded-xl border border-red-500">
                    <h2 className="text-xl font-bold mb-2">Error Fetching Stats</h2>
                    <p className="opacity-80">{(e as Error).message}</p>
                    <a href="/dashboard" className="block mt-4 underline text-sm hover:text-white/80">Try different user</a>
                </div>
            </div>
        );
    }

    return (
        <DashboardClient initialStats={stats} userId={userId} year={year} />
    );
}
