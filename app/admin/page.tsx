import { getAdminUsers, getSystemStatus } from '@/lib/actions/admin';
import AdminDashboardClient from './AdminDashboardClient';
import { verifyAdminSession } from '@/lib/auth-admin';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
    // 1. Fetch System Status
    const status = await getSystemStatus();

    // 2. Verify Auth
    const session = await verifyAdminSession();
    const isAuthenticated = !!session;

    // 3. Fetch Users (only if initialized AND authenticated)
    const users = (status.initialized && isAuthenticated) ? await getAdminUsers() : [];

    // 4. Render Client
    return <AdminDashboardClient initialUsers={users} status={status} isAuthenticated={isAuthenticated} />;
}
