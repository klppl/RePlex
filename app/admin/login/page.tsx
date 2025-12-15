'use client';

import { useState } from 'react';

export default function AdminLoginPage() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        const formData = new FormData(e.currentTarget);
        const data = Object.fromEntries(formData);

        try {
            const res = await fetch('/api/auth/admin/login', {
                method: 'POST',
                body: JSON.stringify(data),
                headers: { 'Content-Type': 'application/json' }
            });

            if (res.ok) {
                // Login successful, redirect to dashboard
                window.location.href = '/admin';
            } else {
                const json = await res.json();
                setError(json.error || 'Login failed');
            }
        } catch (e) {
            setError('An error occurred');
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-slate-950 text-white p-8 flex items-center justify-center">
            <div className="max-w-md w-full relative">
                <div className="absolute inset-0 bg-emerald-500/10 blur-3xl rounded-full"></div>
                <form onSubmit={handleLogin} className="relative bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-xl space-y-6">
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 shadow-inner">
                            🔐
                        </div>
                        <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">
                            SysAdmin Access
                        </h1>
                        <p className="text-slate-400 text-sm mt-2">Identify yourself.</p>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Username</label>
                        <input name="username" required autoFocus className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none transition" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Password</label>
                        <input name="password" type="password" required className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none transition" />
                    </div>

                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-sm text-center">
                            {error}
                        </div>
                    )}

                    <button type="submit" disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-emerald-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition transform active:scale-[0.99]">
                        {loading ? 'Authenticating...' : 'Unlock System'}
                    </button>

                    <div className="text-center pt-4">
                        <a href="/" className="text-xs text-slate-500 hover:text-emerald-400 transition">Back to Home</a>
                    </div>
                </form>
            </div>
        </div>
    );
}
