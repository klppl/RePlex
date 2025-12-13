'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AdminUserType, deleteUser, purgeSystem, saveSystemConfig, generateUserStats, generateAllStats, syncTautulliUsers } from '@/lib/actions/admin';
import { formatDistanceToNow } from 'date-fns';

type AdminView = 'users' | 'settings' | 'setup';

interface Props {
    initialUsers: AdminUserType[];
    status: {
        initialized: boolean;
        hasAdmin: boolean;
        config: any;
    };
}

export default function AdminDashboardClient({ initialUsers, status }: Props) {
    const router = useRouter();

    // View State
    const [view, setView] = useState<AdminView>(status.initialized ? 'users' : 'setup');
    const [users, setUsers] = useState(initialUsers);

    useEffect(() => {
        setUsers(initialUsers);
    }, [initialUsers]);

    // Sync State
    const [isSyncing, setIsSyncing] = useState(false);

    // Deletion State
    const [deletingId, setDeletingId] = useState<number | null>(null);

    // Generation State
    const [generatingId, setGeneratingId] = useState<number | null>(null);
    const [isGeneratingAll, setIsGeneratingAll] = useState(false);

    // Purge State
    const [isPurging, setIsPurging] = useState(false);
    const [confirmPurge, setConfirmPurge] = useState(false);

    // Setup/Config State
    const [configLoading, setConfigLoading] = useState(false);
    const [configError, setConfigError] = useState('');

    // --- HANDLERS ---

    const handleSync = async () => {
        setIsSyncing(true);
        const res = await syncTautulliUsers();
        if (res.success) {
            alert(`Synced ${res.count} users from Tautulli!`);
            router.refresh();
        } else {
            alert("Sync failed: " + res.error);
        }
        setIsSyncing(false);
    };

    const handleDeleteUser = async (id: number) => {
        if (!confirm("Are you sure you want to delete this user and all their data?")) return;
        setDeletingId(id);
        const res = await deleteUser(id);
        if (res.success) {
            setUsers(users.filter(u => u.id !== id));
        } else {
            alert("Failed to delete user");
        }
        setDeletingId(null);
    };

    const handleGenerateUser = async (id: number) => {
        setGeneratingId(id);
        const res = await generateUserStats(id);
        if (res.success) {
            router.refresh();
        } else {
            alert("Failed: " + res.error);
        }
        setGeneratingId(null);
    };

    const handleGenerateAll = async () => {
        if (!confirm("WARNING: generating profiles for ALL users can be very resource intensive and slow for big servers. Are you sure?")) return;

        setIsGeneratingAll(true);
        const res = await generateAllStats();
        setIsGeneratingAll(false);

        if (res.success) {
            alert("Generation Complete!");
            router.refresh();
        } else {
            alert("Generation failed: " + res.error);
        }
    };

    const handlePurge = async () => {
        setIsPurging(true);
        const res = await purgeSystem();
        if (res.success) {
            window.location.reload();
        } else {
            alert("Purge failed. Check console.");
            setIsPurging(false);
        }
    };

    const handleConfigSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setConfigLoading(true);
        setConfigError('');

        const formData = new FormData(e.currentTarget);
        const data: any = Object.fromEntries(formData);
        const res = await saveSystemConfig(data);

        if (res.success) {
            if (view === 'setup') {
                window.location.reload();
            } else {
                alert("Settings saved!");
            }
        } else {
            setConfigError(res.error || "Failed to save settings");
        }
        setConfigLoading(false);
    };

    // --- RENDER HELPERS ---

    const renderHeader = () => (
        <div className="flex items-center justify-between border-b border-slate-800 pb-8">
            <div>
                <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
                    {view === 'setup' ? 'Welcome to RePlex' : 'Admin Dashboard'}
                </h1>
                <p className="text-slate-400 mt-2">
                    {view === 'setup' ? 'Let\'s get your system configured.' : 'Manage users and system data.'}
                </p>
            </div>
            {view !== 'setup' && (
                <div className="flex gap-3">
                    <button
                        onClick={handleSync}
                        disabled={isSyncing || isGeneratingAll}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2 ${isSyncing ? 'bg-indigo-600/50 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500 text-white'}`}
                    >
                        {isSyncing ? 'Syncing...' : '🔄 Sync Users'}
                    </button>

                    {view === 'users' && users.length > 0 && (
                        <button
                            onClick={handleGenerateAll}
                            disabled={isGeneratingAll}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2 ${isGeneratingAll ? 'bg-amber-600/50 cursor-not-allowed' : 'bg-amber-600 hover:bg-amber-500 text-white'}`}
                        >
                            {isGeneratingAll ? (
                                <>
                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Crunching Data...
                                </>
                            ) : (
                                <>⚡ Generate ALL</>
                            )}
                        </button>
                    )}
                    <button
                        onClick={() => router.push('/')}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-medium transition"
                    >
                        Back to Home
                    </button>
                </div>
            )}
        </div>
    );

    const renderNav = () => {
        if (view === 'setup') return null;
        return (
            <div className="flex gap-4 border-b border-slate-800/50 pb-1">
                <button
                    onClick={() => setView('users')}
                    className={`px-4 py-3 text-sm font-bold border-b-2 transition ${view === 'users' ? 'border-emerald-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                >
                    User Management
                </button>
                <button
                    onClick={() => setView('settings')}
                    className={`px-4 py-3 text-sm font-bold border-b-2 transition ${view === 'settings' ? 'border-emerald-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                >
                    Settings
                </button>
            </div>
        );
    };

    const renderUsers = () => (
        <div className="space-y-6 animate-in fade-in duration-300">
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                <span className="bg-blue-500/10 text-blue-400 p-2 rounded-lg">👥</span>
                User Management
            </h2>
            <div className="grid gap-4">
                {users.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 bg-slate-900/50 rounded-2xl border border-slate-800 border-dashed">
                        No users found.
                    </div>
                ) : (
                    users.map(user => (
                        <div key={user.id} className="bg-slate-900 p-6 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-center gap-6 group hover:border-slate-700 transition">
                            <div className="relative">
                                {user.thumb && user.thumb !== 'null' ? (
                                    <img src={user.thumb} alt={user.username || 'User'} className="w-16 h-16 rounded-full object-cover border-2 border-slate-700" />
                                ) : (
                                    <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center text-2xl">👤</div>
                                )}
                                <div className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-slate-900 ${user.historyCount > 0 ? 'bg-emerald-500' : 'bg-slate-500'}`} title={user.historyCount > 0 ? "Data Synced" : "No Data"} />
                            </div>

                            <div className="flex-1 text-center md:text-left">
                                <h3 className="text-xl font-bold text-white flex items-center gap-2 justify-center md:justify-start">
                                    {user.username || `User ${user.id}`}
                                    {generatingId === user.id ? (
                                        <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] uppercase font-bold tracking-wider border border-amber-500/30 flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                                            Generating...
                                        </span>
                                    ) : user.statsGeneratedAt ? (
                                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] uppercase font-bold tracking-wider border border-emerald-500/30">
                                            Cached
                                        </span>
                                    ) : null}
                                </h3>
                                <p className="text-slate-400 text-sm">{user.email || 'No email'}</p>
                                <div className="mt-2 text-xs font-mono text-slate-500 bg-black/30 inline-block px-2 py-1 rounded">
                                    ID: {user.id} • History: {user.historyCount.toLocaleString()}
                                    {user.statsGeneratedAt && ` • Gen: ${formatDistanceToNow(new Date(user.statsGeneratedAt), { addSuffix: true })}`}
                                </div>
                            </div>

                            <div className="flex items-center gap-3 w-full md:w-auto">
                                <button
                                    onClick={() => handleGenerateUser(user.id)}
                                    disabled={generatingId === user.id}
                                    className="flex-1 md:flex-none px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/50 rounded-lg text-sm font-bold transition disabled:opacity-50"
                                    title="Regenerate Stats Cache"
                                >
                                    {generatingId === user.id ? '...' : '↻ Gen'}
                                </button>
                                <button
                                    onClick={() => router.push(`/dashboard?userId=${user.id}`)}
                                    disabled={user.historyCount === 0}
                                    className="flex-1 md:flex-none px-4 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/50 rounded-lg text-sm font-bold transition disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                    View
                                </button>
                                <button
                                    onClick={() => {
                                        const url = `${window.location.origin}/dashboard?userId=${user.id}`;
                                        navigator.clipboard.writeText(url);
                                        alert("Link copied to clipboard!");
                                    }}
                                    className="flex-1 md:flex-none px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700/50 rounded-lg text-sm transition"
                                    title="Copy Shareable Link"
                                >
                                    🔗
                                </button>
                                <button
                                    onClick={() => handleDeleteUser(user.id)}
                                    disabled={deletingId === user.id}
                                    className="flex-1 md:flex-none px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/50 rounded-lg text-sm font-bold transition disabled:opacity-50"
                                >
                                    {deletingId === user.id ? '...' : 'Delete'}
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Danger Zone */}
            <div className="mt-12 pt-12 border-t border-slate-800/50">
                <h2 className="text-2xl font-bold text-red-500 flex items-center gap-3 mb-6">
                    <span className="bg-red-500/10 p-2 rounded-lg">⚠️</span>
                    Danger Zone
                </h2>

                <div className="bg-red-950/20 border border-red-500/30 p-8 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-8">
                    <div>
                        <h3 className="text-xl font-bold text-red-400 mb-2">Factory Reset</h3>
                        <p className="text-red-200/60 max-w-lg">
                            This will permanently delete ALL data, including the database, user history, and the admin account.
                            The application will return to the setup screen.
                            <br /><strong className="text-red-400">This action cannot be undone.</strong>
                        </p>
                    </div>

                    {!confirmPurge ? (
                        <button
                            onClick={() => setConfirmPurge(true)}
                            className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-lg shadow-red-900/20 transition transform active:scale-95"
                        >
                            Purge All Data
                        </button>
                    ) : (
                        <div className="flex flex-col items-center gap-3 animate-in fade-in zoom-in duration-200">
                            <p className="text-red-400 font-bold text-sm uppercase tracking-wider">Are you absolutely sure?</p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setConfirmPurge(false)}
                                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handlePurge}
                                    disabled={isPurging}
                                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg shadow-lg"
                                >
                                    {isPurging ? 'Nuking...' : 'Yes, Delete Everything'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    const renderSettings = () => (
        <div className="space-y-6 max-w-2xl mx-auto animate-in fade-in duration-300">
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                <span className="bg-slate-500/10 text-slate-400 p-2 rounded-lg">⚙️</span>
                System Configuration
            </h2>

            <form onSubmit={handleConfigSubmit} className="bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-xl space-y-8">
                {/* Connection Details */}
                <div className="space-y-6">
                    <h3 className="text-lg font-bold text-emerald-400 uppercase tracking-widest text-xs border-b border-slate-800 pb-2">Tautulli Connection</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">IP / Hostname</label>
                            <input name="ip" defaultValue={status.config?.ip} placeholder="192.168.1.100" required className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none transition" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Port</label>
                            <input name="port" type="number" defaultValue={status.config?.port || "8181"} required className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none transition" />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">API Key</label>
                        <input name="apiKey" type="password" defaultValue={status.config?.apiKey} placeholder="Your Tautulli API Key" required className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none transition" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">URL Base / Root Path (Optional)</label>
                        <input name="rootPath" defaultValue={status.config?.rootPath} placeholder="/tautulli" className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none transition" />
                    </div>
                    <div className="flex items-center gap-3">
                        <input type="checkbox" name="useSsl" id="useSsl" defaultChecked={status.config?.useSsl} className="w-5 h-5 rounded bg-slate-800 border-slate-700 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-900" />
                        <label htmlFor="useSsl" className="text-slate-300 select-none cursor-pointer">Use SSL (HTTPS)</label>
                    </div>
                </div>

                {/* Admin Account - Only if Setup Mode (Creating New) */}
                {view === 'setup' && !status.hasAdmin && (
                    <div className="space-y-6 pt-6 border-t border-slate-800">
                        <h3 className="text-lg font-bold text-emerald-400 uppercase tracking-widest text-xs border-b border-slate-800 pb-2">Create Admin Account</h3>
                        <div className="space-y-2">
                            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Username</label>
                            <input name="username" required className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none transition" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Password</label>
                            <input name="password" type="password" required className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none transition" />
                        </div>
                    </div>
                )}

                {configError && (
                    <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-sm text-center">
                        {configError}
                    </div>
                )}

                <button type="submit" disabled={configLoading} className="w-full bg-emerald-500 hover:bg-emerald-400 text-white font-bold py-4 rounded-xl shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2 transition transform active:scale-[0.99]">
                    {configLoading ? 'Saving...' : (view === 'setup' ? 'Complete Setup 🚀' : 'Save Changes')}
                </button>
            </form>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-950 text-white p-8">
            <div className="max-w-6xl mx-auto space-y-8">
                {renderHeader()}
                {renderNav()}

                {view === 'users' && renderUsers()}
                {(view === 'settings' || view === 'setup') && renderSettings()}
            </div>
        </div>
    );
}
