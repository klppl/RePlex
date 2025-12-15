'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { AdminUserType, purgeAllData, syncTautulliUsers, syncAllUsersHistory, saveSystemConfig, deleteUserReport, generateUserStats, generateAllStats, generateLoginLink } from "@/lib/actions/admin";
import { formatDistanceToNow } from 'date-fns';

type AdminView = 'users' | 'settings' | 'setup' | 'login';

interface Props {
    initialUsers: AdminUserType[];
    status: {
        initialized: boolean;
        hasAdmin: boolean;
        config: any;
        aiConfig: any;
        mediaConfig: any;
    };
    isAuthenticated: boolean;
}

export default function AdminDashboardClient({ initialUsers, status, isAuthenticated }: Props) {
    const router = useRouter();

    // View State
    const [view, setView] = useState<AdminView>(
        !status.initialized ? 'setup' :
            (!isAuthenticated ? 'login' : 'users')
    );
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

    // Login State
    const [loginLoading, setLoginLoading] = useState(false);
    const [loginError, setLoginError] = useState('');

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

    const handleDeleteReport = async (id: number) => {
        if (!confirm("Are you sure you want to delete the generated report? The user and their history will remain.")) return;
        setDeletingId(id);
        const res = await deleteUserReport(id);
        if (res.success) {
            // Update local state to remove the generated flag
            setUsers(users.map(u => u.id === id ? { ...u, statsGeneratedAt: null } : u));
        } else {
            alert("Failed to delete report");
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
        // Switch to terminal view if hidden or other view? 
        // We'll just ensure terminal is visible
        if (!isTerminalContentVisible) setIsTerminalContentVisible(true);

        setTerminalLogs(['Initializing generation...']);
        setIsStreaming(true); // Reuse streaming state for terminal styling

        try {
            const response = await fetch('/api/admin/generate');
            const reader = response.body?.getReader();
            if (!reader) throw new Error('Failed to start stream');

            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n').filter(Boolean);

                setTerminalLogs(prev => {
                    const newLogs = [...prev, ...lines];
                    return newLogs.slice(-1000);
                });
            }

            alert("Generation Complete!");
            router.refresh();
        } catch (error) {
            console.error(error);
            setTerminalLogs(prev => [...prev, `[ERROR] Connection failed: ${error}`]);
            alert("Generation failed");
        } finally {
            setIsGeneratingAll(false);
            setIsStreaming(false);
        }
    };

    const handlePurge = async () => {
        setIsPurging(true);
        const res = await purgeAllData();
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
    };

    const handleLogout = async () => {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
            window.location.href = '/';
        } catch (e) {
            window.location.href = '/';
        }
    };

    const handleGenerateLink = async (id: number) => {
        const res = await generateLoginLink(id);
        if (res.success && res.token) {
            const url = `${window.location.origin}/login?token=${res.token}`;
            await navigator.clipboard.writeText(url);
            alert("Login link generated and copied to clipboard!");
        } else {
            alert("Failed to generate link: " + res.error);
        }
    };




    // Terminal / Streaming State
    const [isStreaming, setIsStreaming] = useState(false);
    const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
    const [isTerminalContentVisible, setIsTerminalContentVisible] = useState(true);
    const terminalRef = useRef<HTMLDivElement>(null);

    // Auto-scroll terminal
    useEffect(() => {
        if (terminalRef.current) {
            terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }
    }, [terminalLogs]);


    const handleSyncAll = async () => {
        setIsStreaming(true);
        setTerminalLogs(['Initializing global sync...']);

        try {
            const response = await fetch('/api/admin/sync');
            const reader = response.body?.getReader();
            if (!reader) throw new Error('Failed to start stream');

            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n').filter(Boolean);

                setTerminalLogs(prev => {
                    // Keep last 1000 lines
                    const newLogs = [...prev, ...lines];
                    return newLogs.slice(-1000);
                });
            }

            // Refresh logic if needed, or just let users reload manually
            // window.location.reload(); 
        } catch (error) {
            console.error(error);
            setTerminalLogs(prev => [...prev, `[ERROR] Connection failed: ${error}`]);
        } finally {
            setIsStreaming(false);
        }
    };

    const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoginLoading(true);
        setLoginError('');

        const formData = new FormData(e.currentTarget);
        const data = Object.fromEntries(formData);

        try {
            const res = await fetch('/api/auth/admin/login', {
                method: 'POST',
                body: JSON.stringify(data),
                headers: { 'Content-Type': 'application/json' }
            });

            if (res.ok) {
                window.location.reload();
            } else {
                const json = await res.json();
                setLoginError(json.error || 'Login failed');
            }
        } catch (e) {
            setLoginError('An error occurred');
        }
        setLoginLoading(false);
    };

    // --- RENDER HELPERS ---

    const renderHeader = () => (
        <div className="flex items-center justify-between border-b border-slate-800 pb-8">
            <div>
                <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
                    {view === 'setup' ? 'Welcome to RePlex' : (view === 'login' ? 'SysAdmin Access' : 'Admin Dashboard')}
                </h1>
                <p className="text-slate-400 mt-2">
                    {view === 'setup' ? 'Let\'s get your system configured.' : (view === 'login' ? 'Identify yourself.' : 'Manage users and system data.')}
                </p>
            </div>
            {view !== 'setup' && view !== 'login' && (
                <div className="flex gap-3">
                    <button
                        onClick={handleSync}
                        disabled={isSyncing || isGeneratingAll}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2 ${isSyncing ? 'bg-indigo-600/50 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500 text-white'}`}
                        title="Fetch user list from Tautulli"
                    >
                        {isSyncing ? 'Syncing List...' : '🔄 Sync List'}
                    </button>

                    <button
                        onClick={handleSyncAll}
                        disabled={isStreaming}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2 ${isStreaming ? 'bg-blue-600/50 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}
                        title="Download history for all users"
                    >
                        {isStreaming ? 'Downloading...' : '⬇️ Download All Data'}
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
                                    Generating...
                                </>
                            ) : (
                                <>⚡ Generate Downloaded</>
                            )}
                        </button>
                    )}
                    <button
                        onClick={() => router.push('/')}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-medium transition"
                    >
                        Home
                    </button>
                    <button
                        onClick={handleLogout}
                        className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/50 rounded-lg text-sm font-bold transition"
                    >
                        Logout
                    </button>
                </div>
            )}

        </div>
    );

    const renderNav = () => {
        if (view === 'setup' || view === 'login') return null;
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
                                <div className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-slate-900 ${user.statsGeneratedAt ? 'bg-emerald-500' :
                                    user.historyCount > 0 ? 'bg-yellow-500' :
                                        'bg-red-500'
                                    }`} title={user.statsGeneratedAt ? "Report Generated" : user.historyCount > 0 ? "Data Downloaded" : "No Data"} />
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
                                            Report Generated
                                        </span>
                                    ) : user.historyCount > 0 ? (
                                        <span className="px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 text-[10px] uppercase font-bold tracking-wider border border-yellow-500/30">
                                            Data Downloaded
                                        </span>
                                    ) : (
                                        <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-[10px] uppercase font-bold tracking-wider border border-red-500/30">
                                            No Data
                                        </span>
                                    )}
                                </h3>
                                <p className="text-slate-400 text-sm">{user.email || 'No email'}</p>
                                <div className="mt-2 text-xs font-mono text-slate-500 bg-black/30 inline-block px-2 py-1 rounded" suppressHydrationWarning>
                                    ID: {user.id} • History: {user.historyCount.toLocaleString()}
                                    {user.statsGeneratedAt && ` • Gen: ${formatDistanceToNow(new Date(user.statsGeneratedAt), { addSuffix: true })}`}
                                </div>
                            </div>

                            <div className="flex items-center gap-3 w-full md:w-auto">
                                <button
                                    onClick={() => handleGenerateLink(user.id)}
                                    className="flex-1 md:flex-none px-3 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 rounded-lg text-sm font-bold transition"
                                    title="Generate Login Link"
                                >
                                    🔑 Link
                                </button>
                                <button
                                    onClick={() => handleGenerateUser(user.id)}
                                    disabled={generatingId === user.id}
                                    className="flex-1 md:flex-none px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/50 rounded-lg text-sm font-bold transition disabled:opacity-50"
                                    title="Regenerate Stats Cache"
                                >
                                    {generatingId === user.id ? '...' : '↻ Gen'}
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
                                    onClick={() => handleDeleteReport(user.id)}
                                    disabled={!user.statsGeneratedAt || deletingId === user.id}
                                    className="flex-1 md:flex-none px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/50 rounded-lg text-sm font-bold transition disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {deletingId === user.id ? '...' : (user.statsGeneratedAt ? 'Del Rep' : 'No Rep')}
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
        </div >
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
                        <label htmlFor="useSsl" className="text-slate-300 select-none cursor-pointer">Use SSL (HTTPS)</label>
                    </div>
                </div>

                {/* AI Configuration */}
                <div className="space-y-6 pt-6 border-t border-slate-800">
                    <h3 className="text-lg font-bold text-purple-400 uppercase tracking-widest text-xs border-b border-slate-800 pb-2">AI Summary Configuration</h3>
                    <div className="flex items-center gap-3">
                        <input type="checkbox" name="aiEnabled" id="aiEnabled" defaultChecked={status.aiConfig?.enabled} className="w-5 h-5 rounded bg-slate-800 border-slate-700 text-purple-500 focus:ring-purple-500 focus:ring-offset-slate-900" />
                        <label htmlFor="aiEnabled" className="text-slate-300 select-none cursor-pointer">Enable AI Summary</label>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">OpenAI API Key</label>
                        <input name="aiKey" type="password" defaultValue={status.aiConfig?.apiKey || ''} placeholder="sk-..." className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-purple-500 outline-none transition" />
                        <p className="text-xs text-slate-600">Key is stored locally in your database.</p>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Custom Instructions / Persona</label>
                        <textarea name="aiInstructions" defaultValue={status.aiConfig?.instructions || "Analyze the user’s Plex statistics and produce a brutally honest /r/roastme-style roast. Be mean, dry, and sarcastic. No empathy, no disclaimers, no praise unless it is immediately undercut. Treat the stats as evidence of bad habits, questionable taste, avoidance of sleep, commitment issues, nostalgia addiction, or fake “good taste.” If data is missing, infer something unflattering. Write one or two short paragraphs that summarize the user as a person based solely on their viewing behavior. No emojis, no self-reference, no moral lessons. Roast choices and habits only, not protected traits. The result should be funny, uncomfortable, and very shareable."} placeholder="Analyze the user’s Plex statistics and produce a brutally honest /r/roastme-style roast..." rows={5} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-purple-500 outline-none transition" />
                    </div>
                </div>

                {/* Media Metadata Configuration */}
                <div className="space-y-6 pt-6 border-t border-slate-800">
                    <h3 className="text-lg font-bold text-amber-400 uppercase tracking-widest text-xs border-b border-slate-800 pb-2">Media Metadata Configuration</h3>
                    <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">TMDB API Key</label>
                        <input name="tmdbApiKey" type="password" defaultValue={status.mediaConfig?.tmdbApiKey || ''} placeholder="Metric tonnes of metadata..." className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-amber-500 outline-none transition" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">TVDB API Key</label>
                        <input name="tvdbApiKey" type="password" defaultValue={status.mediaConfig?.tvdbApiKey || ''} placeholder="Even more metadata..." className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-amber-500 outline-none transition" />
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

                {/* Maintenance Section - Only show when not in setup mode */}
                {view !== 'setup' && (
                    <div className="space-y-6 pt-8 border-t border-slate-800">
                        <h3 className="text-lg font-bold text-blue-400 uppercase tracking-widest text-xs border-b border-slate-800 pb-2">Maintenance</h3>

                        <div className="bg-slate-950/30 p-6 rounded-xl border border-blue-500/10 flex items-center justify-between gap-4">
                            <div>
                                <h4 className="text-white font-bold mb-1">Pre-fetch User History</h4>
                                <p className="text-slate-400 text-sm">
                                    Download all history for the current year for ALL active users. This makes the user dashboard load instantly.
                                    <br />
                                    <span className="text-xs text-slate-500 italic">Warning: This may take a while depending on the number of users.</span>
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={handleSyncAll}
                                disabled={isStreaming}
                                className="px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition disabled:opacity-50 flex-shrink-0"
                            >
                                {isStreaming ? 'Syncing...' : 'Sync All Data'}
                            </button>
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

    const renderLogin = () => (
        <div className="max-w-md mx-auto animate-in fade-in duration-300 relative">
            <div className="absolute inset-0 bg-emerald-500/10 blur-3xl rounded-full"></div>
            <form onSubmit={handleLogin} className="relative bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-xl space-y-6">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 shadow-inner">
                        🔐
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Username</label>
                    <input name="username" required autoFocus className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none transition" />
                </div>
                <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Password</label>
                    <input name="password" type="password" required className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none transition" />
                </div>

                {loginError && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-sm text-center">
                        {loginError}
                    </div>
                )}

                <button type="submit" disabled={loginLoading} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-emerald-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition transform active:scale-[0.99]">
                    {loginLoading ? 'Authenticating...' : 'Unlock System'}
                </button>
            </form>
        </div>
    );

    const renderTerminal = () => (
        <div className="bg-black rounded-lg border border-gray-800 overflow-hidden font-mono text-xs md:text-sm shadow-2xl transition-all duration-300">
            <div
                className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800 cursor-pointer hover:bg-gray-800 transition-colors"
                onClick={() => setIsTerminalContentVisible(!isTerminalContentVisible)}
            >
                <span className="text-gray-400 flex items-center gap-2 font-bold tracking-widest uppercase">
                    <span className={`w-2 h-2 rounded-full ${isStreaming ? 'bg-green-500 animate-pulse' : 'bg-red-900'}`}></span>
                    SYSTEM_ENTROPY
                </span>
                <div className="flex items-center gap-4">
                    <span className="text-[10px] text-gray-600 uppercase tracking-widest">{isTerminalContentVisible ? 'COLLAPSE' : 'EXPAND'}</span>
                </div>
            </div>

            {isTerminalContentVisible && (
                <div
                    ref={terminalRef}
                    className="h-64 overflow-y-auto p-4 space-y-1 scroll-smooth bg-black/95 text-green-500 font-mono"
                >
                    {terminalLogs.length === 0 && !isStreaming && (
                        <div className="text-gray-800 italic select-none text-center mt-20 opacity-50">
                            // WAITING_FOR_INPUT...
                        </div>
                    )}
                    {terminalLogs.map((log, i) => (
                        <div key={i} className={`${log.includes('[ERROR]') ? 'text-red-500 font-bold' :
                            log.includes('[SYNC]') ? 'text-cyan-400' :
                                log.includes('[ADMIN]') ? 'text-yellow-500' :
                                    'text-gray-400'
                            }`}>
                            <span className="text-gray-700 mr-3 select-none text-[10px] uppercase tracking-tighter">[{new Date().toLocaleTimeString()}]</span>
                            {log}
                        </div>
                    ))}
                    {isStreaming && (
                        <div className="text-green-500 animate-pulse">_</div>
                    )}
                </div>
            )}
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-950 text-white p-8">
            <div className="max-w-6xl mx-auto space-y-8">
                {renderHeader()}
                {view !== 'login' && view !== 'setup' && renderTerminal()}
                {renderNav()}

                {view === 'users' && renderUsers()}
                {view === 'login' && renderLogin()}
                {(view === 'settings' || view === 'setup') && renderSettings()}
            </div>
        </div>
    );
}
