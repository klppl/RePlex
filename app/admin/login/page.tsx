import { getSystemStatus } from '@/lib/actions/admin';
import AdminDashboardClient from '../AdminDashboardClient';
import LoginForm from './LoginForm';

export const dynamic = 'force-dynamic';

export default async function AdminLoginPage() {
    const status = await getSystemStatus();

    // If not initialized, show the setup wizard (managed by AdminDashboardClient)
    if (!status.initialized) {
        return <AdminDashboardClient initialUsers={[]} status={status} isAuthenticated={false} />;
    }

    // Otherwise show the login form
    return <LoginForm />;
}
