'use client';

import { useEffect, useState, Suspense } from 'react';
import { validateLoginToken } from '@/lib/actions/auth';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginContent() {
    const searchParams = useSearchParams();
    const token = searchParams.get('token');

    const [error, setError] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(!!token);
    const router = useRouter();

    useEffect(() => {
        if (token) {
            const doLogin = async () => {
                const res = await validateLoginToken(token);
                if (res?.error) {
                    setError(res.error);
                    setLoading(false);
                }
            };
            doLogin();
        }
    }, [token]);

    if (!token) {
        // ... existing JSX for no token
        return (
            <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
                <div className="max-w-md w-full text-center space-y-6">
                    <div className="w-20 h-20 bg-slate-900 rounded-full flex items-center justify-center mx-auto text-4xl shadow-xl border border-slate-800">
                        🔒
                    </div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-400">
                        User Login
                    </h1>
                    <p className="text-slate-400">
                        Please use the secure <strong>Access Link</strong> provided by your administrator to log in.
                    </p>
                    <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-yellow-500 text-sm">
                        No password required. Just click the link.
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        // ... existing JSX for error
        return (
            <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-slate-900 border border-red-500/30 p-8 rounded-2xl shadow-2xl text-center space-y-4">
                    <div className="text-4xl">❌</div>
                    <h2 className="text-xl font-bold text-red-400">Login Failed</h2>
                    <p className="text-slate-300">{error}</p>
                    <div className="pt-4">
                        <a href="/" className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm text-white transition">Back to Home</a>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
            <div className="text-center space-y-4">
                <div className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto"></div>
                <h2 className="text-xl font-medium text-emerald-400 animate-pulse">Authenticating...</h2>
            </div>
        </div>
    );
}

export default function UserLoginPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-slate-950" />}>
            <LoginContent />
        </Suspense>
    );
}
