'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function HomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [status, setStatus] = useState(''); // 'initializing', 'waiting', 'success'
  const [error, setError] = useState('');

  // Check if system is initialized (Admin exists)
  useEffect(() => {
    const checkInit = async () => {
      try {
        const res = await fetch('/api/auth/admin/check');
        const data = await res.json();

        if (!data.initialized) {
          router.replace('/admin');
          return;
        }

        setCheckingStatus(false);
      } catch (e) {
        // If check fails for some reason, let them stay (or retry)
        setCheckingStatus(false);
      }
    };
    checkInit();
  }, [router]);

  const handlePlexLogin = async () => {
    setLoading(true);
    setStatus('initializing');
    setError('');

    try {
      // 1. Get PIN
      const res = await fetch('/api/auth/plex/init', { method: 'POST' });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      // 2. Open Popup
      const width = 600;
      const height = 700;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;
      const popup = window.open(
        data.url,
        'Plex Logic',
        `width=${width},height=${height},top=${top},left=${left},scrollbars=yes,status=yes,resizable=yes`
      );

      setStatus('waiting');

      // 3. Poll
      const interval = setInterval(async () => {
        if (popup?.closed) {
          clearInterval(interval);
          setLoading(false);
          setStatus('');
          return;
        }

        try {
          const checkRes = await fetch(`/api/auth/plex/check?id=${data.id}`);
          const checkData = await checkRes.json();

          if (checkData.status === 'success') {
            clearInterval(interval);
            popup?.close();
            setStatus('success');
            router.push(`/dashboard?userId=${checkData.userId}`);
          } else if (checkData.error) {
            // If user not found, stop polling
            clearInterval(interval);
            popup?.close();
            setError(checkData.error);
            setLoading(false);
          }
        } catch (e) {
          // Ignore network errors during polling
        }
      }, 2000);

    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  if (checkingStatus) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden text-white">
        <svg className="animate-spin h-8 w-8 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
        <p className="mt-4 text-lg">Checking system status...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Gradients */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-1/2 -left-1/2 w-[1000px] h-[1000px] bg-emerald-500/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-1/2 -right-1/2 w-[1000px] h-[1000px] bg-teal-500/10 rounded-full blur-3xl"></div>
      </div>

      <div className="z-10 w-full max-w-md bg-white/5 backdrop-blur-lg border border-white/10 p-8 rounded-2xl shadow-2xl flex flex-col items-center">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400 mb-2">
            RePlex
          </h1>
          <p className="text-slate-400 text-sm">Your Movie & TV Stats Wrapped</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-sm text-center w-full">
            {error}
          </div>
        )}

        <button
          onClick={handlePlexLogin}
          disabled={loading}
          className="w-full bg-[#E5A00D] hover:bg-[#D49000] text-black font-bold py-4 rounded-xl shadow-lg transition-all transform active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-5 w-5 text-black" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              {status === 'waiting' ? 'Check your popup...' : 'Connecting...'}
            </span>
          ) : (
            <>
              <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
                <path d="M12.98 12.028l-5.694 5.726v-11.41l5.694 5.684zm-4.49 4.41l4.385-4.42-4.385-4.37v8.79zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18.5c-4.69 0-8.5-3.81-8.5-8.5s3.81-8.5 8.5-8.5 8.5 3.81 8.5 8.5-3.81 8.5-8.5 8.5z" />
              </svg>
              Sign in with Plex
            </>
          )}
        </button>

        <p className="mt-4 text-xs text-slate-500 text-center">
          Or go to <Link href="/admin" className="text-slate-400 hover:text-white underline">Admin Setup</Link>
        </p>

      </div>
    </div>
  );
}
