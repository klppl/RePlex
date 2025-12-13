import { getAdminUsers, getSystemStatus } from '@/lib/actions/admin';
import AdminDashboardClient from './AdminDashboardClient';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
    // 1. Fetch System Status
    const status = await getSystemStatus();

    // 2. Fetch Users (only if initialized to avoid errors or wasted calls)
    const users = status.initialized ? await getAdminUsers() : [];

    // 3. Render Client
    return <AdminDashboardClient initialUsers={users} status={status} />;
}
