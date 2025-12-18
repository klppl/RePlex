'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { StatCard } from '../components/StatCard';
import { ComparisonChart } from '../components/ComparisonChart';
import { Router } from 'lucide-react';
import { StatsResult } from '@/lib/services/stats';

interface DashboardClientProps {
    initialStats: StatsResult | null;
    userId: number;
    year: number;
    shouldGenerate?: boolean;
}

export default function DashboardClient({ initialStats, userId, year, shouldGenerate = false }: DashboardClientProps) {
    const router = useRouter();

    // State
    const [stats, setStats] = useState<StatsResult | null>(initialStats);
    const [isGenerating, setIsGenerating] = useState(shouldGenerate);

    // Treat null/undefined totalSeconds as 0 if stats exist
    const currentSeconds = stats?.totalSeconds || 0;
    const hasData = currentSeconds > 0;

    // IF no data AND not generating, immediately show No Data screen.
    // We do NOT auto-sync. Admin handles sync.
    const [noDataFound, setNoDataFound] = useState(!hasData && !shouldGenerate);

    const [synced, setSynced] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [expandedActor, setExpandedActor] = useState<string | null>(null);
    const [expandedCommitment, setExpandedCommitment] = useState(false);
    const [loadingAi, setLoadingAi] = useState(false);
    const [uploadDots, setUploadDots] = useState("");

    const logBuffer = useRef<string[]>((isGenerating)
        ? ["Initializing RePlex Protocol...", "Connecting to Neural Net...", "Loading Personality Matrix..."]
        : (!hasData)
            ? ["Initializing RePlex Protocol...", "Connecting to Neural Net...", "Loading Personality Matrix..."]
            : []);

    const isSyncActive = useRef(false);
    const quotesShown = useRef(0);
    const [redirecting, setRedirecting] = useState(false);
    const [redirectDots, setRedirectDots] = useState("");

    const FUNNY_QUOTES = [
        "Dont Netflix and Chill. Plex and sex.",
        "Stream and sleep",
        "Buffering and Suffering",
        "Binge and Cringe",
        "My server stays up longer than you do.",
        "Friends don't let friends transcode.",
        "Calculating total hours of regret...",
        "Judging your movie taste...",
        "Analyzing your bandwidth abuse.",
        "Tallying up your sleepless nights.",
        "Checking if you actually watched it, or just fell asleep.",
        "Transcoding your life choices...",
        "Skipping intros...",
        "Finding subtitles for your existence...",
        "My load balance is heavy.",
        "One more episode. Again.",
        "Content hoarded successfully.",
        "This seemed like a good idea at 02:13.",
        "You paid for this bandwidth.",
        "Your ISP is watching.",
        "Detecting unnecessary 4K streams.",
        "Calculating your most ignored genre...",
        "Ranking shows you never finished.",
        "Measuring commitment issues per season.",
        "Determining your comfort-show dependency.",
        "Finding the episode you rewatched 'by accident'.",
        "This says more about you than you think.",
        "This playlist is a cry for help.",
        "Watching anything to feel something.",
        "Yes, you watched the same actor again."
    ];

    // Fun Loading Sequence for No Data
    useEffect(() => {
        if (!noDataFound) return;

        let isMounted = true;
        const sequence = async () => {
            // Wait for initial logs to drain
            await new Promise(r => setTimeout(r, 2000));
            if (!isMounted) return;

            // Show some funny quotes
            const quotesToShow = 3;
            for (let i = 0; i < quotesToShow; i++) {
                const randomQuote = FUNNY_QUOTES[Math.floor(Math.random() * FUNNY_QUOTES.length)];
                logBuffer.current.push(`> ${randomQuote}`);
                await new Promise(r => setTimeout(r, 2500)); // Read time
                if (!isMounted) return;
            }

            // Realization
            logBuffer.current.push("Analyzing watch history...");
            await new Promise(r => setTimeout(r, 2000));
            if (!isMounted) return;

            logBuffer.current.push("Wait...");
            await new Promise(r => setTimeout(r, 1000));
            if (!isMounted) return;

            logBuffer.current.push("Error: No data found.");
            await new Promise(r => setTimeout(r, 1500));
            if (!isMounted) return;

            // logBuffer.current.push("Yet.");
            // await new Promise(r => setTimeout(r, 1000));
            // if (!isMounted) return;

            logBuffer.current.push("Ask your Admin to sync your data.");
            await new Promise(r => setTimeout(r, 2000));
            if (!isMounted) return;

            // Start Redirect
            setRedirecting(true);
            logBuffer.current.push("Redirecting to login...");

            setTimeout(() => {
                if (isMounted) window.location.href = '/';
            }, 3000);
        };

        sequence();

        return () => { isMounted = false; };
    }, [noDataFound]);

    // Animate dots for redirect
    useEffect(() => {
        if (!redirecting) return;
        const interval = setInterval(() => {
            setRedirectDots(prev => {
                if (prev.length >= 3) return "";
                return prev + ".";
            });
        }, 500);
        return () => clearInterval(interval);
    }, [redirecting]);

    // Log draining effect (The "Typewriter" effect)
    useEffect(() => {
        // ... (rest of existing effect)        if (!loading && !noDataFound) return;
        const interval = setInterval(() => {
            if (logBuffer.current.length > 0) {
                const nextLog = logBuffer.current.shift();
                if (nextLog) {
                    setLogs(prev => {
                        const newLogs = [...prev, nextLog];
                        if (newLogs.length > 100) return newLogs.slice(-100);
                        return newLogs;
                    });
                }
            }
        }, 60);

        return () => clearInterval(interval);
    }, [loading, noDataFound]);

    // Uploading dots animation
    useEffect(() => {
        if (!loadingAi) return;
        const interval = setInterval(() => {
            setUploadDots(prev => prev.length >= 3 ? "" : prev + ".");
        }, 500);
        return () => clearInterval(interval);
    }, [loadingAi]);

    const performSync = async (force: boolean, signal?: AbortSignal) => {
        if (loading || isSyncActive.current) return;
        setLoading(true);
        setLogs([]);
        setProgress(0);
        logBuffer.current = ["Initiating Sync Protocol..."];
        isSyncActive.current = true;
        quotesShown.current = 0;
        let completedSuccessfully = false;

        const fromDate = `${year}-01-01`;
        const now = new Date();
        const isCurrentYear = now.getFullYear() === year;
        const toDate = isCurrentYear ? now.toISOString().split('T')[0] : `${year}-12-31`;

        try {
            const response = await fetch('/api/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, from: fromDate, to: toDate, force }),
                signal // Use abort signal
            });


            if (!response.body) throw new Error("No response body");
            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            let done = false;
            while (!done) {
                const { value, done: doneReading } = await reader.read();
                done = doneReading;
                if (value) {
                    const chunk = decoder.decode(value);
                    const lines = chunk.split('\n').filter(l => l.trim());
                    for (const line of lines) {
                        if (line.startsWith('PROGRESS:')) {
                            // Parse progress
                            const pct = parseInt(line.split(':')[1], 10);
                            if (!isNaN(pct)) setProgress(pct);
                        } else if (line.startsWith('MONTH_START:')) {
                            const month = line.substring(12);
                            logBuffer.current.push(`> Analyzing ${month}...`);

                            // One-liner per month
                            const randomQuote = FUNNY_QUOTES[Math.floor(Math.random() * FUNNY_QUOTES.length)];
                            logBuffer.current.push(`> ${randomQuote}`);

                        } else if (line.startsWith('SYNC_COMPLETE:')) {
                            logBuffer.current.push(">> Sync Sequence Complete.");
                            setProgress(100);
                        } else if (line.startsWith('ERROR:')) {
                            console.error("Sync Error", line);
                            logBuffer.current.push("!! ERROR !! " + line.substring(6));
                        } else {
                            logBuffer.current.push("> " + line);
                        }
                    }
                }
            }

            console.log("Sync finished reading stream.");
            setSynced(true);
            isSyncActive.current = false;
            setProgress(100);

            // Allow the buffer to drain
            while (logBuffer.current.length > 0) {
                await new Promise(r => setTimeout(r, 100));
            }

            // Refresh stats to check if we have data
            const statsRes = await fetch(`/api/stats?userId=${userId}&year=${year}&refresh=true`);
            const newStats = await statsRes.json();

            // Check for No Data
            if (newStats.totalSeconds === 0) {
                logBuffer.current.push("Error: No data found.");
                // We pause here to let the user read it, but since we are in the async function loop
                // and the log drainer runs in useEffect, pushing to buffer works.
                // We need to wait for drainer to show it.
                await new Promise(r => setTimeout(r, 1500));

                logBuffer.current.push("Yet.");
                await new Promise(r => setTimeout(r, 1500));

                logBuffer.current.push("The power of yet.");

                setNoDataFound(true);
                setLoading(false);
                return; // Stop here, don't do AI stuff
            }

            const AI_LOADING_MESSAGES = [
                "Escalating to artificial intelligence.",
                "Feeding the machine your coping mechanisms.",
                "Asking a machine what this says about you.",
                "Handing over the evidence.",
                "Reducing you to watch history.",
                "Converting time spent into truth.",
                "Interpretation pending.",
                "Uploading behavioral patterns.",
                "Submitting your year for judgment."
            ];

            // Allow user to read final message
            await new Promise(r => setTimeout(r, 1500));

            const randomMsg = AI_LOADING_MESSAGES[Math.floor(Math.random() * AI_LOADING_MESSAGES.length)];
            logBuffer.current.push(`>> ${randomMsg}`);

            setLoadingAi(true); // New state to trigger the uploading text in UI

            await new Promise(r => setTimeout(r, 3000)); // Wait for "upload"

            setLoadingAi(false);

            completedSuccessfully = true;
            setLoading(false); // Force loading off before state update

            // Short delay to allow react to flush
            await new Promise(r => setTimeout(r, 0));
            setStats(newStats);

        } catch (err: any) {
            if (err.name === 'AbortError') {
                console.log("Sync aborted.");
                return;
            }
            console.error("Sync failed:", err);
            logBuffer.current.push("!! CRITICAL FAILURE !! " + err.message);
            isSyncActive.current = false;
            await new Promise(r => setTimeout(r, 3000));
        } finally {
            if (!signal?.aborted || completedSuccessfully || (stats.totalSeconds === 0)) { // Ensure loading off if we found no data too
                setLoading(false);
            }
        }
    };

    const handleForceRefresh = () => {
        if (!confirm("Force refresh? This re-downloads all data.")) return;
        setSynced(false);
        setNoDataFound(false);
        performSync(true);
    };

    // Generation Effect
    useEffect(() => {
        if (!isGenerating) return;

        const controller = new AbortController();
        let isMounted = true;

        const runGeneration = async () => {
            try {
                // Start pumping fun messages
                const quotesInterval = setInterval(() => {
                    if (!isMounted) return;
                    const randomQuote = FUNNY_QUOTES[Math.floor(Math.random() * FUNNY_QUOTES.length)];
                    logBuffer.current.push(`> ${randomQuote}`);
                }, 3000);

                // Fetch stats
                const res = await fetch(`/api/stats?userId=${userId}&year=${year}&refresh=true`, {
                    signal: controller.signal
                });

                if (!res.ok) throw new Error("Stats generation failed");

                const newStats = await res.json();

                if (!isMounted) {
                    clearInterval(quotesInterval);
                    return;
                }

                clearInterval(quotesInterval);

                // Transition
                logBuffer.current.push(">> Analysis Complete.");
                logBuffer.current.push(">> Rendering Dashboard...");

                await new Promise(r => setTimeout(r, 1000));

                if (isMounted) {
                    setStats(newStats);
                    setIsGenerating(false);

                    if ((newStats.totalSeconds || 0) === 0) {
                        setNoDataFound(true);
                    }
                }

            } catch (e: any) {
                if (e.name === 'AbortError') return;
                console.error("Generation error", e);
                if (isMounted) {
                    logBuffer.current.push(`!! Error: ${e.message}`);
                    // Maybe setNoDataFound(true) after delay?
                }
            }
        };

        runGeneration();

        return () => {
            isMounted = false;
            controller.abort();
        };
    }, [isGenerating, userId, year]);

    // Show loader if explicitly loading, OR if we are in the auto-sync state (empty stats, not synced yet), OR if No Data Found, OR if Generating
    if (loading || (!stats) || (stats.totalSeconds === 0 && !synced) || noDataFound || isGenerating) {
        return (
            <div className="min-h-screen bg-[#111] flex flex-col items-center justify-center p-4">
                {/* CRT Monitor Case */}
                <div className="relative w-full max-w-4xl aspect-video bg-[#222] rounded-3xl shadow-2xl flex flex-col overflow-hidden p-4 pb-10 border-t-2 border-white/5">

                    {/* Screen Glass/Container */}
                    <div className="relative flex-1 bg-[#051005] overflow-hidden shadow-[inset_0_0_80px_rgba(0,0,0,1)] rounded-xl border border-black/50 ring-1 ring-white/10 flex flex-col">

                        {/* Scanlines & RGB Split Overlay */}
                        <div className="absolute inset-0 pointer-events-none z-20 opacity-20"
                            style={{
                                backgroundImage: `linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))`,
                                backgroundSize: '100% 4px, 6px 100%'
                            }}>
                        </div>

                        {/* Screen Reflection/Gloss */}
                        <div className="absolute inset-0 pointer-events-none z-30 bg-gradient-to-br from-white/5 to-transparent rounded-xl"></div>

                        {/* Flicker Animation */}
                        <div className="absolute inset-0 pointer-events-none z-10 bg-green-500/5 animate-pulse mix-blend-overlay"></div>

                        {/* Content Area */}
                        <div className="relative z-0 flex-1 p-8 font-mono text-green-500 overflow-y-auto flex flex-col"
                            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                            ref={(el) => { if (el) el.scrollTop = el.scrollHeight; }}>
                            <style jsx>{`
                                ::-webkit-scrollbar {
                                    display: none;
                                }
                             `}</style>
                            <div className="mb-6 text-center opacity-70 uppercase tracking-[0.2em] text-[10px] pb-4 border-b border-green-900/30 flex justify-center items-center gap-2">
                                <div className="w-2 h-2 bg-green-500 rounded-full animate-ping"></div>
                                RePlex OS v1.0 // {isGenerating ? "Data Analysis Protocol" : "Sync Protocol"}
                            </div>

                            {logs.map((log, i) => (
                                <div key={i} className={`mb-1 text-sm md:text-base break-words font-medium tracking-wide drop-shadow-[0_0_5px_rgba(34,197,94,0.6)] ${log.startsWith("!!") ? "text-red-400 drop-shadow-[0_0_8px_rgba(248,113,113,0.8)]" : log.startsWith(">>") ? "text-emerald-300 font-bold" : "text-green-500/90"}`}>
                                    <span className="opacity-20 mr-4 select-none text-[10px] aligned-top">{(i + 1).toString().padStart(3, '0')}</span>
                                    {log}
                                </div>
                            ))}
                            {loadingAi && (
                                <div className="mb-1 text-sm md:text-base break-words font-medium tracking-wide text-emerald-300 drop-shadow-[0_0_5px_rgba(34,197,94,0.6)] animate-pulse">
                                    <span className="opacity-20 mr-4 select-none text-[10px] aligned-top">{(logs.length + 1).toString().padStart(3, '0')}</span>
                                    &gt;&gt; Uploading Data{uploadDots}
                                </div>
                            )}

                            {redirecting && (
                                <div className="mb-1 text-sm md:text-base break-words font-medium tracking-wide text-green-400 drop-shadow-[0_0_5px_rgba(34,197,94,0.6)] animate-pulse">
                                    <span className="opacity-20 mr-4 select-none text-[10px] aligned-top">{(logs.length + 1).toString().padStart(3, '0')}</span>
                                    Sending you back{redirectDots}
                                </div>
                            )}

                            {!noDataFound && !isGenerating && <div className="text-green-500/80 animate-pulse mt-1 ml-9">_</div>}
                            {isGenerating && <div className="text-green-500/80 animate-pulse mt-1 ml-9">Processing...</div>}

                        </div>

                        {/* Progress Bar Area (Fixed at bottom of screen) */}
                        <div className="relative z-20 p-6 pt-0">
                            <div className="w-full h-4 border border-green-800/50 bg-black/40 rounded-sm relative overflow-hidden">
                                <div className="h-full bg-green-500/50 transition-all duration-300 ease-out" style={{ width: `${isGenerating ? 100 : progress}%` }}></div>
                                {/* Striped pattern overlay for retro look */}
                                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 5px, #000 5px, #000 10px)' }}></div>
                                <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-green-400 tracking-widest drop-shadow-[0_0_2px_black]">
                                    {noDataFound ? 'SYSTEM HALTED.' : isGenerating ? 'ANALYZING NEURAL PATTERNS...' : `SYNCING DATA... ${progress}%`}
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        );
    }

    if (!stats) return null; // Satisfy TS for main render

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500/30">

            {/* Navigation / Header */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-white/5 px-6 py-4 flex justify-between items-center">
                <div>
                    <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">RePlex</span>
                    <span className="ml-2 text-xs text-slate-500 hidden sm:inline">User #{userId}</span>
                </div>
                <div className="flex gap-4">
                    <button
                        onClick={async () => {
                            try {
                                await fetch('/api/auth/logout', { method: 'POST' });
                                window.location.href = '/';
                            } catch (e) {
                                window.location.href = '/';
                            }
                        }}
                        className="text-xs font-semibold uppercase tracking-wider text-red-500 hover:text-red-400 transition"
                    >
                        Logout
                    </button>
                </div>
            </nav>

            <main className="max-w-4xl mx-auto px-6 pt-32 pb-32 space-y-32">

                {/* HERO SECTION: INTRO & TOTAL TIME */}
                <section className="text-center space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000">
                    <div>
                        <h1 className="text-5xl md:text-7xl font-black mb-2 tracking-tight">
                            Your {year} <span className="text-[#e5a00d]">Plex</span> <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">Wrapped</span>
                        </h1>
                        <p className="text-xl text-slate-400">You spent a lot of time watching screens.</p>
                    </div>

                    {/* AI SUMMARY */}
                    {stats.aiSummary && (
                        <div className="max-w-2xl mx-auto bg-gradient-to-br from-purple-900/20 to-indigo-900/20 border border-purple-500/30 p-8 rounded-3xl shadow-2xl relative overflow-hidden group">
                            {/* Decorative quotes */}
                            <div className="absolute top-4 left-4 text-6xl text-purple-500/20 font-serif leading-none">“</div>
                            <div className="absolute bottom-4 right-4 text-6xl text-purple-500/20 font-serif leading-none rotate-180">“</div>

                            <div className="relative z-10">
                                <div className="flex items-center justify-center gap-2 mb-4">
                                    <span className="bg-purple-500/10 text-purple-400 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest border border-purple-500/20">
                                        AI Analysis
                                    </span>
                                </div>
                                <p className="text-lg md:text-xl text-purple-100 font-medium leading-relaxed italic">
                                    {stats.aiSummary}
                                </p>
                            </div>

                            {/* Background glow */}
                            <div className="absolute inset-0 bg-purple-500/5 blur-3xl rounded-full group-hover:bg-purple-500/10 transition duration-1000"></div>
                        </div>
                    )}

                    <div className="py-12 relative group cursor-default">
                        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 rounded-3xl blur-3xl group-hover:bg-emerald-500/20 transition duration-500"></div>
                        <div className="relative bg-slate-900/50 border border-white/10 p-12 rounded-3xl backdrop-blur-sm">
                            <p className="text-emerald-400 font-medium uppercase tracking-widest mb-4">Total Watch Time</p>
                            <div className="text-6xl md:text-8xl font-black text-white mb-4 tracking-tighter">
                                {stats.totalDuration}
                            </div>
                            <div className="flex justify-center gap-8 mt-8 text-sm text-slate-400">
                                <div>
                                    <span className="block text-emerald-400 font-bold text-xl">{Math.round(stats.mediaTypeSplit.movies / 3600)}h</span>
                                    <span>Movies</span>
                                </div>
                                <div className="h-10 w-px bg-slate-800"></div>
                                <div>
                                    <span className="block text-blue-400 font-bold text-xl">{Math.round(stats.mediaTypeSplit.shows / 3600)}h</span>
                                    <span>TV Shows</span>
                                </div>
                            </div>

                            <div className="mt-8 pt-8 border-t border-white/5">
                                <p className="text-xl text-slate-400">
                                    That's equivalent to working a <span className="text-emerald-400 font-bold">full-time job</span> for <span className="text-white font-bold">{((stats.totalSeconds / 3600) / 160).toFixed(1)} months</span>.
                                    <br /><span className="text-sm opacity-60 italic">(Hope the pay was good)</span>
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* 7. VALUE PROPOSITION */}
                    {stats.valueProposition && (
                        <div className="bg-slate-900 p-12 rounded-3xl border border-slate-800 hover:border-emerald-500/50 transition group relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition transform group-hover:scale-110 duration-700">
                                <span className="text-9xl">💰</span>
                            </div>

                            <h3 className="text-emerald-400 uppercase tracking-widest text-sm font-bold mb-4">Value Proposition</h3>

                            <div className="relative z-10">
                                <div className="text-6xl md:text-8xl font-black text-white mb-4 tracking-tighter">
                                    ${stats.valueProposition.toLocaleString()}
                                </div>
                                <div className="text-xl text-slate-400 max-w-2xl">
                                    That's how much this content would have cost you <span className="text-emerald-400 font-bold">at market value</span>.
                                    <p className="mt-4 text-sm text-slate-500 italic">
                                        $12 per movie + one month's sub ($15.49) for every 10h of TV.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 7b. PIRATE BAY VALUE */}
                    {stats.pirateBayValue && (
                        <div className="mt-8 bg-slate-900 p-12 rounded-3xl border border-slate-800 hover:border-red-600/50 transition group relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition transform group-hover:scale-110 duration-700">
                                <span className="text-9xl">🏴‍☠️</span>
                            </div>

                            <h3 className="text-red-500 uppercase tracking-widest text-sm font-bold mb-4">The "Find Out" Value</h3>

                            <div className="relative z-10">
                                <div className="text-6xl md:text-8xl font-black text-white mb-4 tracking-tighter drop-shadow-[0_0_15px_rgba(220,38,38,0.5)]">
                                    ${stats.pirateBayValue.toLocaleString()}
                                </div>
                                <div className="text-xl text-slate-400 max-w-2xl">
                                    That's how much this content would have cost you <span className="text-red-500 font-bold">in legal fines</span>.
                                    <p className="mt-4 text-sm text-slate-500 italic">
                                        Calculated based on maximum US statutory damages for willful infringement ($150k per title).
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 8. BANDWIDTH CONSUMED (Moved to Top) */}
                    <div className="mt-8">
                        {/* The ISP Enemy (Redesigned) */}
                        <div className="bg-slate-900 p-12 rounded-3xl border border-slate-800 hover:border-orange-500/50 transition group relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition transform group-hover:scale-110 duration-700 text-orange-500">
                                <Router size={160} strokeWidth={1} />
                            </div>

                            <h3 className="text-orange-400 uppercase tracking-widest text-sm font-bold mb-4">Bandwidth Consumed</h3>

                            {(() => {
                                const gb = (stats.totalBandwidth || 0) / (1024 * 1024 * 1024);
                                const tb = gb / 1024;
                                let displayVal = `${Math.round(gb).toLocaleString()} GB`;
                                if (tb >= 10) displayVal = `${tb.toFixed(1)} TB`;
                                else if (tb >= 1) displayVal = `${tb.toFixed(2)} TB`;

                                let title = "The Ghost";
                                let text = "Your ISP thinks this house is vacant. You barely scratched the copper cables.";

                                if (gb >= 50000) {
                                    title = "The Backbone Provider";
                                    text = "Congratulations, you are now legally considered a data center. The neighborhood dimming lights? That’s you downloading a 4K remux.";
                                } else if (gb >= 10000) {
                                    title = "The Throttled One";
                                    text = "You are the reason 'Unlimited Data' now has an asterisk (*). Support definitely put a 'Do Not Answer' note on your file.";
                                } else if (gb >= 2000) {
                                    title = "The Profit Killer";
                                    text = "You pulled terabytes down the pipe. Your ISP has likely pinned a picture of your router on their office dartboard.";
                                } else if (gb >= 500) {
                                    title = "The Average Joe";
                                    text = "You’re flying under the radar. Your ISP loves you: you pay full price but barely use the pipes.";
                                }

                                return (
                                    <div className="relative z-10">
                                        <div className="text-6xl md:text-8xl font-black text-white mb-4 tracking-tighter">
                                            {displayVal}
                                        </div>
                                        <div className="mb-4">
                                            <span className="inline-block bg-orange-500/10 text-orange-400 border border-orange-500/20 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest">
                                                {title}
                                            </span>
                                        </div>
                                        <p className="text-xl text-slate-400 max-w-2xl">
                                            {text}
                                        </p>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>

                    {/* 9. COMPARISON CHART (New) */}
                    {stats.comparison && (
                        <div className="mt-8">
                            <ComparisonChart comparison={stats.comparison} />
                        </div>
                    )}

                </section>

                {/* PERSONALITY & DEEP DIVE (Consolidated DNA) */}
                <section className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-150">
                    <div className="flex items-center gap-4 mb-8">
                        <span className="text-4xl">🧬</span>
                        <h2 className="text-3xl font-bold">Your DNA</h2>
                    </div>

                    <div className="flex flex-col gap-8">
                        {/* 1. THE USUAL SUSPECTS (Top Actors) */}
                        <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 flex flex-col hover:border-pink-500/50 transition duration-300">
                            <div className="flex justify-between items-start mb-1">
                                <h3 className="text-pink-400 uppercase tracking-widest text-sm font-bold">The Usual Suspects</h3>
                                <div className="text-3xl opacity-50">👥</div>
                            </div>
                            <p className="text-slate-400 text-sm mb-6 italic opacity-75">The faces you couldn't stop watching.</p>

                            <div className="space-y-8 flex-1">
                                {stats.yourStan && stats.yourStan.length > 0 ? (
                                    <>
                                        {/* TOP SUSPECT */}
                                        {(() => {
                                            const topSuspect = stats.yourStan[0];
                                            const initials = topSuspect.actor.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
                                            return (
                                                <div
                                                    className="flex flex-col items-center text-center cursor-pointer group"
                                                    onClick={() => setExpandedActor(expandedActor === topSuspect.actor ? null : topSuspect.actor)}
                                                >
                                                    <div className="w-24 h-24 rounded-full bg-yellow-500/10 border-2 border-yellow-500 flex items-center justify-center text-2xl font-black text-yellow-500 mb-3 shadow-[0_0_20px_rgba(234,179,8,0.2)] group-hover:scale-105 transition duration-300 overflow-hidden relative">
                                                        {topSuspect.imageUrl ? (
                                                            <img src={topSuspect.imageUrl} alt={topSuspect.actor} className="w-full h-full object-cover" />
                                                        ) : (
                                                            initials
                                                        )}
                                                    </div>
                                                    <div className="text-xl font-bold text-white group-hover:text-yellow-400 transition">{topSuspect.actor}</div>
                                                    <div className="text-sm text-yellow-500/60 font-medium">{topSuspect.count} titles</div>

                                                    {expandedActor === topSuspect.actor && (
                                                        <div className="mt-4 p-4 bg-slate-950/50 rounded-xl w-full text-left animate-in slide-in-from-top-2 fade-in duration-200">
                                                            {topSuspect.titles.slice(0, 5).map((t, idx) => (
                                                                <div key={idx} className="text-xs text-slate-400 py-1 border-b border-white/5 last:border-0">{t}</div>
                                                            ))}
                                                            {topSuspect.titles.length > 5 && <div className="text-[10px] text-slate-600 italic mt-2">and {topSuspect.titles.length - 5} more...</div>}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })()}

                                        {/* ACCOMPLICES */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {stats.yourStan.slice(1).map((s, i) => {
                                                const initials = s.actor.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
                                                // Rotate colors
                                                const colors = ['text-pink-400 bg-pink-400/10', 'text-cyan-400 bg-cyan-400/10', 'text-indigo-400 bg-indigo-400/10', 'text-emerald-400 bg-emerald-400/10'];
                                                const colorClass = colors[i % colors.length];

                                                return (
                                                    <div
                                                        key={i}
                                                        className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition cursor-pointer group"
                                                        onClick={() => setExpandedActor(expandedActor === s.actor ? null : s.actor)}
                                                    >
                                                        <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold ${colorClass} overflow-hidden relative`}>
                                                            {s.imageUrl ? (
                                                                <img src={s.imageUrl} alt={s.actor} className="w-full h-full object-cover" />
                                                            ) : (
                                                                initials
                                                            )}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-sm font-medium text-slate-200 truncate group-hover:text-white transition">{s.actor}</div>
                                                            <div className="text-xs text-slate-500">{s.count} titles</div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* EXPANDED VIEW FOR ACCOMPLICES (Shared area or just implied they click?) 
                                            Actually, rendering expanded details inside the grid might break layout. 
                                            Let's render a shared detail box if an accomplice is selected.
                                        */}
                                        {expandedActor && stats.yourStan.slice(1).find(s => s.actor === expandedActor) && (
                                            <div className="mt-2 p-4 bg-slate-950/50 rounded-xl animate-in slide-in-from-top-2 fade-in duration-200">
                                                <h4 className="text-xs font-bold text-slate-300 mb-2 uppercase tracking-wider">
                                                    {expandedActor}'s appearances
                                                </h4>
                                                {stats.yourStan.find(s => s.actor === expandedActor)?.titles.slice(0, 5).map((t, idx) => (
                                                    <div key={idx} className="text-xs text-slate-400 py-1 border-b border-white/5 last:border-0">{t}</div>
                                                ))}
                                            </div>
                                        )}

                                        <div className="mt-6 pt-6 border-t border-slate-800 text-center">
                                            <p className="text-slate-300">
                                                You spent <span className="text-pink-400 font-bold">{Math.round(stats.yourStan.reduce((a, c) => a + (c.time || 0), 0) / 3600)} hours</span> with these people.
                                            </p>
                                        </div>
                                    </>
                                ) : (
                                    <p className="text-slate-500 text-center my-auto">No actor data.</p>
                                )}
                            </div>
                        </div>

                        {/* 2. GENRE WHEEL */}
                        <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 flex flex-col hover:border-emerald-500/50 transition">
                            <div className="flex justify-between items-start mb-6">
                                <h3 className="text-emerald-400 uppercase tracking-widest text-sm font-bold">Genre Breakdown</h3>
                                <div className="text-3xl opacity-50">🎨</div>
                            </div>
                            <div className="flex-1">
                                {stats.genreWheel.length > 0 ? (
                                    <div className="grid grid-cols-12 grid-rows-2 h-64 gap-1 rounded-2xl overflow-hidden">
                                        {stats.genreWheel.map((g, i) => {
                                            // Colors for organic feel
                                            const colors = ['bg-emerald-600', 'bg-teal-600', 'bg-cyan-700', 'bg-blue-700', 'bg-indigo-700'];
                                            const color = colors[i % colors.length];

                                            // Grid classes
                                            // Item 0: Big block (Left half)
                                            // Others: Quarter blocks (Right half)
                                            let gridClass = "col-span-6 md:col-span-3 row-span-1";
                                            if (i === 0) gridClass = "col-span-12 md:col-span-6 row-span-2";

                                            return (
                                                <div
                                                    key={i}
                                                    className={`${gridClass} ${color} relative p-4 flex flex-col justify-center items-center text-center transition hover:opacity-90 group/block cursor-default`}
                                                >
                                                    <div className="font-bold text-white relative z-10">
                                                        {i === 0 ? (
                                                            <>
                                                                <span className="text-2xl md:text-3xl block">{g.genre}</span>
                                                                <span className="text-sm md:text-base opacity-50 block mt-1 font-normal italic">(Again?)</span>
                                                            </>
                                                        ) : (
                                                            <span className="text-sm md:text-lg">{g.genre}</span>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-white/50 mt-1 font-mono">{g.percentage}%</div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <p className="text-slate-500 text-center my-auto py-12">No genre data available.</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* 3. BLAST FROM THE PAST */}
                    {(stats.oldestMovie || stats.oldestShow) && (
                        <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 hover:border-cyan-500/50 transition">
                            <h3 className="text-cyan-400 uppercase tracking-widest text-sm font-bold mb-8">Blast from the Past</h3>
                            <div className="flex flex-col gap-8">
                                {stats.oldestMovie && (
                                    <div className="flex items-center gap-4 bg-slate-950/50 p-4 rounded-2xl border border-white/5">
                                        <div className="text-4xl">🦕</div>
                                        <div>
                                            <div className="text-xs text-slate-500 uppercase font-bold mb-1">Oldest Movie</div>
                                            <div className="font-bold text-white text-lg">{stats.oldestMovie.title}</div>
                                            <div className="text-slate-400 text-sm">Released in {stats.oldestMovie.year}</div>
                                        </div>
                                    </div>
                                )}
                                {stats.oldestShow && (
                                    <div className="flex items-center gap-4 bg-slate-950/50 p-4 rounded-2xl border border-white/5">
                                        <div className="text-4xl">📺</div>
                                        <div>
                                            <div className="text-xs text-slate-500 uppercase font-bold mb-1">Oldest TV Show</div>
                                            <div className="font-bold text-white text-lg">{stats.oldestShow.title}</div>
                                            <div className="text-slate-400 text-sm">Released in {stats.oldestShow.year}</div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* 7. INSIGHTS (Commitment & Binge - Moved Up) */}
                    <div className="flex flex-col gap-8">
                        {stats.commitmentIssues.count > 0 && (
                            <div
                                className="bg-slate-900 p-8 rounded-3xl border border-slate-800 flex flex-col gap-6 hover:border-red-500/50 transition cursor-pointer group"
                                onClick={() => setExpandedCommitment(!expandedCommitment)}
                            >
                                <div className="flex items-center gap-6">
                                    <div className="text-4xl text-red-400 bg-red-900/10 p-4 rounded-full">💔</div>
                                    <div>
                                        <h3 className="text-slate-400 uppercase tracking-widest text-xs font-bold mb-1">Commitment Issues</h3>
                                        <p className="text-lg font-bold text-white leading-tight">
                                            You abandoned <span className="text-red-400 group-hover:underline underline-offset-4 decoration-red-500/50 transition">{stats.commitmentIssues.count} movies</span> before the 20% mark.
                                        </p>
                                    </div>
                                    <div className="ml-auto text-slate-500 text-sm opacity-50 group-hover:opacity-100 transition">
                                        {expandedCommitment ? '▲' : '▼'}
                                    </div>
                                </div>

                                {expandedCommitment && (
                                    <div className="mt-2 pt-6 border-t border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-y-2 gap-x-4 animate-in slide-in-from-top-2 fade-in duration-300">
                                        {stats.commitmentIssues.titles.map((title, i) => (
                                            <div key={i} className="flex items-start gap-2 text-sm text-slate-400">
                                                <span className="text-red-500/50 mt-1">•</span>
                                                <span className="group-hover:text-slate-300 transition">{title}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {stats.bingeRecord && (
                            <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 flex items-center gap-6 hover:border-blue-500/50 transition">
                                <div className="text-4xl text-blue-400 bg-blue-900/10 p-4 rounded-full">🥤</div>
                                <div>
                                    <h3 className="text-slate-400 uppercase tracking-widest text-xs font-bold mb-1">Binge Record</h3>
                                    <p className="text-lg font-bold text-white leading-tight">
                                        On {stats.bingeRecord.date}, you watched <span className="text-blue-400">{stats.bingeRecord.count} episodes</span> of {stats.bingeRecord.show} in a row.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 4. HABITS & TIME (Stacked) */}
                    <div className="flex flex-col gap-8">

                        {/* LAZIEST DAY (Bar Chart) */}
                        <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 flex flex-col hover:border-purple-500/50 transition group">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h3 className="text-purple-400 uppercase tracking-widest text-sm font-bold mb-1">Laziest Day</h3>
                                    <div className="text-2xl font-black text-white">{stats.lazyDay.winner.day}</div>
                                    <p className="text-slate-400 text-xs">{stats.lazyDay.winner.hours} hours total.</p>
                                </div>
                                <div className="text-2xl opacity-20 group-hover:opacity-100 transition">📅</div>
                            </div>

                            {/* Bar Chart Container */}
                            <div className="flex items-end justify-between h-48 gap-3 mt-4 px-2">
                                {stats.lazyDay.chartData.map((d, i) => {
                                    const max = Math.max(...stats.lazyDay.chartData.map(x => x.hours));
                                    const h = max > 0 ? (d.hours / max) * 100 : 0;
                                    const isWinner = d.day === stats.lazyDay.winner.day;
                                    return (
                                        <div key={i} className="flex flex-col items-center gap-2 flex-1 group/bar h-full justify-end">
                                            <div className="w-full relative flex items-end justify-center h-full max-h-full rounded-t-sm overflow-visible bg-slate-800/30 rounded-lg pb-0">
                                                <div
                                                    className={`w-full mx-0.5 md:mx-1 rounded-t-lg transition-all duration-1000 ease-out ${isWinner ? 'bg-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.4)]' : 'bg-slate-700 group-hover/bar:bg-slate-600'}`}
                                                    style={{ height: `${h}%` }}
                                                ></div>
                                                {/* Tooltip */}
                                                <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover/bar:opacity-100 transition whitespace-nowrap pointer-events-none z-10 border border-white/10 shadow-xl">
                                                    {d.hours}h
                                                </div>
                                            </div>
                                            <div className={`text-[10px] md:text-xs uppercase font-bold ${isWinner ? 'text-purple-400' : 'text-slate-600'}`}>{d.short}</div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* 10. QUALITY CONTROL (Polished Edition) */}
                        {stats.qualityStats && stats.qualityStats.average > 0 && (
                            <div className="bg-slate-900 p-8 md:p-10 rounded-3xl border border-slate-800 flex flex-col hover:border-teal-500/50 transition group relative overflow-hidden">
                                {/* Background Masks - Lighter and Larger */}
                                <div className="absolute -top-10 -right-10 p-8 opacity-5 group-hover:opacity-10 transition transform group-hover:rotate-12 duration-1000 select-none pointer-events-none">
                                    <span className="text-[15rem]">🎭</span>
                                </div>

                                <div className="flex justify-between items-start mb-8 z-10 relative">
                                    <h3 className="text-teal-400 uppercase tracking-widest text-sm font-bold">Quality Profile</h3>
                                </div>

                                <div className="relative z-10 grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-12 items-center">

                                    {/* LEFT: Score Circle (25%) */}
                                    <div className="col-span-1 flex justify-center md:justify-start">
                                        <div className="relative w-40 h-40 md:w-48 md:h-48 flex items-center justify-center">
                                            {/* SVG Progress Ring */}
                                            <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                                                {/* Background Circle */}
                                                <circle
                                                    cx="50" cy="50" r="45"
                                                    fill="transparent"
                                                    stroke="#1e293b"
                                                    strokeWidth="6"
                                                />
                                                {/* Progress Circle */}
                                                <circle
                                                    cx="50" cy="50" r="45"
                                                    fill="transparent"
                                                    stroke={stats.qualityStats.average >= 80 ? '#2dd4bf' : stats.qualityStats.average >= 60 ? '#facc15' : '#f87171'}
                                                    strokeWidth="6"
                                                    strokeDasharray="283"
                                                    strokeDashoffset={283 - (283 * stats.qualityStats.average) / 100}
                                                    strokeLinecap="round"
                                                    className="transition-all duration-1000 ease-out"
                                                />
                                            </svg>

                                            <div className="flex flex-col items-center z-10">
                                                <div className={`text-6xl md:text-7xl font-black tracking-tighter ${stats.qualityStats.average >= 80 ? 'text-teal-400' : stats.qualityStats.average >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
                                                    {stats.qualityStats.average}
                                                </div>
                                                <div className="text-[10px] md:text-xs uppercase tracking-[0.2em] text-slate-500 font-bold mt-1">AVG SCORE</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* RIGHT: Content (75%) */}
                                    <div className="col-span-1 md:col-span-3 flex flex-col text-center md:text-left">

                                        {/* Badge Title */}
                                        <div className="mb-4">
                                            <span className="inline-block bg-teal-500 text-slate-950 px-4 py-1.5 rounded-full text-sm font-black uppercase tracking-widest shadow-[0_0_15px_rgba(45,212,191,0.3)]">
                                                {stats.qualityStats.persona.title}
                                            </span>
                                        </div>

                                        {/* Description */}
                                        <p className="text-xl md:text-2xl font-medium text-slate-200 leading-relaxed mb-8">
                                            {stats.qualityStats.persona.description}
                                        </p>

                                        {/* Stats Footer: The Proof */}
                                        <div className="flex flex-col gap-4 pt-6 border-t border-white/5">

                                            {/* Peak Cinema */}
                                            {(stats.qualityStats.highestMovie || stats.qualityStats.highestShow) && (
                                                <div className="flex items-center gap-4 bg-slate-950/30 p-3 rounded-xl hover:bg-slate-950/50 transition border border-transparent hover:border-teal-500/20 group/item">
                                                    <div className="w-10 h-14 bg-slate-800 rounded shadow-lg overflow-hidden flex-shrink-0 relative flex items-center justify-center">
                                                        {(stats.qualityStats.highestMovie?.poster || stats.qualityStats.highestShow?.poster) ? (
                                                            <img
                                                                src={stats.qualityStats.highestMovie ? stats.qualityStats.highestMovie.poster! : stats.qualityStats.highestShow!.poster!}
                                                                alt="Poster"
                                                                className="w-full h-full object-cover"
                                                                onError={(e) => {
                                                                    e.currentTarget.style.display = 'none';
                                                                    e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                                                }}
                                                            />
                                                        ) : null}
                                                        {/* Fallback Icon (Hidden by default if image exists, shown on error or if no image) */}
                                                        <div className={`absolute inset-0 flex items-center justify-center bg-slate-800 ${(stats.qualityStats.highestMovie?.poster || stats.qualityStats.highestShow?.poster) ? 'hidden' : ''}`}>
                                                            <span className="text-xl opacity-20">🍿</span>
                                                        </div>
                                                    </div>
                                                    <div className="text-left min-w-0 flex-1">
                                                        <div className="flex items-center gap-2 mb-0.5">
                                                            <span className="text-teal-400 font-bold text-xs uppercase tracking-wider">▲ Peak</span>
                                                            <span className="bg-teal-500/10 text-teal-400 text-[10px] font-bold px-1.5 py-0.5 rounded border border-teal-500/20">
                                                                {stats.qualityStats.highestMovie ? stats.qualityStats.highestMovie.score : stats.qualityStats.highestShow?.score}
                                                            </span>
                                                        </div>
                                                        <div className="text-white font-bold text-lg leading-none truncate group-hover/item:text-teal-300 transition">
                                                            {stats.qualityStats.highestMovie ? stats.qualityStats.highestMovie.title : stats.qualityStats.highestShow?.title}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Lowest Point */}
                                            {(stats.qualityStats.lowestMovie || stats.qualityStats.lowestShow) && (
                                                <div className="flex items-center gap-4 bg-slate-950/30 p-3 rounded-xl hover:bg-slate-950/50 transition border border-transparent hover:border-red-500/20 group/item">
                                                    <div className="w-10 h-14 bg-slate-800 rounded shadow-lg overflow-hidden flex-shrink-0 relative flex items-center justify-center grayscale opacity-70 group-hover/item:grayscale-0 group-hover/item:opacity-100 transition">
                                                        {(stats.qualityStats.lowestMovie?.poster || stats.qualityStats.lowestShow?.poster) ? (
                                                            <img
                                                                src={stats.qualityStats.lowestMovie ? stats.qualityStats.lowestMovie.poster! : stats.qualityStats.lowestShow!.poster!}
                                                                alt="Poster"
                                                                className="w-full h-full object-cover"
                                                                onError={(e) => {
                                                                    e.currentTarget.style.display = 'none';
                                                                    e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                                                }}
                                                            />
                                                        ) : null}
                                                        {/* Fallback Icon */}
                                                        <div className={`absolute inset-0 flex items-center justify-center bg-slate-800 ${(stats.qualityStats.lowestMovie?.poster || stats.qualityStats.lowestShow?.poster) ? 'hidden' : ''}`}>
                                                            <span className="text-xl opacity-20">🎬</span>
                                                        </div>
                                                    </div>
                                                    <div className="text-left min-w-0 flex-1">
                                                        <div className="flex items-center gap-2 mb-0.5">
                                                            <span className="text-red-400 font-bold text-xs uppercase tracking-wider">▼ Low</span>
                                                            <span className="bg-red-500/10 text-red-400 text-[10px] font-bold px-1.5 py-0.5 rounded border border-red-500/20">
                                                                {stats.qualityStats.lowestMovie ? stats.qualityStats.lowestMovie.score : stats.qualityStats.lowestShow?.score}
                                                            </span>
                                                        </div>
                                                        <div className="text-white font-bold text-lg leading-none truncate group-hover/item:text-red-300 transition">
                                                            {stats.qualityStats.lowestMovie ? stats.qualityStats.lowestMovie.title : stats.qualityStats.lowestShow?.title}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* VIBE CHECK (Donut Chart) */}
                        <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-8 hover:border-yellow-500/50 transition group overflow-visible">
                            <div className="flex-1 w-full text-center md:text-left">
                                <div className="flex justify-between items-start mb-2 relative">
                                    <div className="w-full">
                                        <h3 className="text-yellow-400 uppercase tracking-widest text-sm font-bold mb-1">Vibe Check</h3>
                                        <div className="text-4xl font-black text-white">{stats.activityType.winner}</div>
                                        <p className="text-slate-400 text-sm mt-3 leading-relaxed max-w-md mx-auto md:mx-0">
                                            {stats.activityType.description}
                                        </p>
                                    </div>
                                    <div className="text-4xl opacity-20 group-hover:opacity-100 transition absolute right-0 top-0">🌙</div>
                                </div>
                            </div>

                            <div className="flex items-center gap-6 flex-shrink-0">
                                {/* Simple CSS Conic Gradient Donut */}
                                {(() => {
                                    const morningData = stats.activityType.breakdown.find(b => b.label === 'Morning') || { value: 0 };
                                    const dayData = stats.activityType.breakdown.find(b => b.label === 'Day') || { value: 0 };
                                    const nightData = stats.activityType.breakdown.find(b => b.label === 'Night') || { value: 0 };

                                    const morning = morningData.value;
                                    const day = dayData.value;
                                    const night = nightData.value;

                                    const total = night + morning + day || 1;
                                    const pNight = (night / total) * 100;
                                    const pMorning = (morning / total) * 100;
                                    const pDay = (day / total) * 100;

                                    return (
                                        <>
                                            <div className="relative w-40 h-40 rounded-full flex items-center justify-center shadow-2xl flex-shrink-0"
                                                style={{
                                                    background: `conic-gradient(
                                                        #22d3ee 0% ${pDay}%, 
                                                        #fbbf24 ${pDay}% ${pDay + pMorning}%, 
                                                        #6366f1 ${pDay + pMorning}% 100%
                                                    )`
                                                }}
                                            >
                                                {/* Inner cutout */}
                                                <div className="w-28 h-28 bg-slate-900 rounded-full flex flex-col items-center justify-center z-10 shadow-inner">
                                                    <div className="text-xs text-slate-500 font-bold uppercase tracking-widest">Total</div>
                                                    <div className="text-white font-bold text-xl">{Math.round(total / 3600)}h</div>
                                                </div>
                                            </div>

                                            {/* Static Legend (No longer absolute) */}
                                            <div className="flex flex-col gap-3 text-sm font-medium min-w-[80px]">
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-2 text-indigo-400 font-bold">
                                                        <div className="w-3 h-3 rounded-full bg-indigo-500"></div> Night 🌙
                                                    </div>
                                                    <div className="text-[10px] text-slate-600 ml-5 font-mono mb-0.5">22:00 - 05:00</div>
                                                    <div className="text-xs text-slate-500 ml-5">{Math.round(night / 3600)}h ({Math.round(pNight)}%)</div>
                                                </div>
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-2 text-amber-400 font-bold">
                                                        <div className="w-3 h-3 rounded-full bg-amber-400"></div> Morning 🌅
                                                    </div>
                                                    <div className="text-[10px] text-slate-600 ml-5 font-mono mb-0.5">05:00 - 11:00</div>
                                                    <div className="text-xs text-slate-500 ml-5">{Math.round(morning / 3600)}h ({Math.round(pMorning)}%)</div>
                                                </div>
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-2 text-cyan-400 font-bold">
                                                        <div className="w-3 h-3 rounded-full bg-cyan-400"></div> Day ☀️
                                                    </div>
                                                    <div className="text-[10px] text-slate-600 ml-5 font-mono mb-0.5">11:00 - 22:00</div>
                                                    <div className="text-xs text-slate-500 ml-5">{Math.round(day / 3600)}h ({Math.round(pDay)}%)</div>
                                                </div>
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>
                            <div className="hidden md:block w-4"></div>
                        </div>

                        {/* TIME TRAVELER */}
                        {/* 4. YOUR MEDIA AGE (Replaces Time Traveler) */}
                        {/* 4. YOUR MEDIA AGE (Replaces Time Traveler) */}
                        {stats.averageYear > 0 && (() => {
                            let diagnosis = "The Time Traveler";
                            let copy = "You're stuck in time.";
                            let icon = "📺";
                            const y = stats.averageYear;

                            if (y >= 2022) {
                                diagnosis = "Shiny Object Syndrome";
                                copy = "You refuse to watch anything without Dolby Vision and an active marketing campaign. If it’s older than your milk, you’re not interested.";
                                icon = "📺";
                            } else if (y >= 2015) {
                                diagnosis = "The Algorithmic Average";
                                copy = "You’re stuck in the peak streaming era. Your taste is perfectly curated to keep you on the couch for just... one... more... episode.";
                                icon = "📺";
                            } else if (y >= 2000) {
                                diagnosis = "The Digital Transition";
                                copy = "Ah, the golden age of piracy and physical media. You miss DVD menus, Limewire, and movies that weren't just prequels to sequels.";
                                icon = "📀";
                            } else if (y >= 1980) {
                                diagnosis = "Certified Retro";
                                copy = "You’re living in the past. Specifically the era of Blockbuster nights, synth-pop soundtracks, and tracking issues on the VHS tape.";
                                icon = "📼";
                            } else if (y >= 1960) {
                                diagnosis = "The Old School Cool";
                                copy = "You prefer practical effects over CGI and pacing slow enough to actually check your phone. A true cinema purist (or just old).";
                                icon = "📺";
                            } else {
                                diagnosis = "The Historian";
                                copy = "Do you know movies come in color now? You spent your year watching dead people talk in a transatlantic accent.";
                                icon = "🎥";
                            }

                            return (
                                <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-8 hover:border-purple-500/50 transition group">
                                    <div className="flex-1 w-full text-center md:text-left">
                                        <h3 className="text-purple-400 uppercase tracking-widest text-sm font-bold mb-1">Your Media Era</h3>
                                        <div className="text-5xl font-black text-white mb-2">{stats.averageYear}</div>

                                        <div className="mb-2">
                                            <span className="text-purple-400 font-bold text-lg block">{diagnosis}</span>
                                        </div>
                                        <p className="text-slate-400 text-sm">
                                            {copy}
                                        </p>
                                        <p className="text-[10px] text-slate-600 mt-4 uppercase tracking-widest opacity-50">Based on weighted average release year</p>
                                    </div>
                                    <div className="text-6xl opacity-20 group-hover:opacity-100 transition animate-pulse">
                                        {icon}
                                    </div>
                                </div>
                            );
                        })()}
                    </div>

                    {/* 5. BIG STATS (Longest Break, Most Episodes) */}
                    <div className="flex flex-col gap-8">
                        {stats.longestBreak && (
                            <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 flex items-center gap-6 hover:border-red-500/50 transition">
                                <div className="text-4xl text-red-400 bg-red-900/10 p-4 rounded-full">⏸️</div>
                                <div>
                                    <h3 className="text-slate-400 uppercase tracking-widest text-xs font-bold mb-1">Longest Break</h3>
                                    <p className="text-lg font-bold text-white leading-tight">
                                        Paused <span className="text-red-400">{stats.longestBreak.title}</span> for {stats.longestBreak.days} days
                                    </p>
                                </div>
                            </div>
                        )}

                        {stats.topShowByEpisodes && (
                            <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 flex items-center gap-6 hover:border-blue-500/50 transition">
                                <div className="text-4xl text-blue-400 bg-blue-900/10 p-4 rounded-full">🔁</div>
                                <div>
                                    <h3 className="text-slate-400 uppercase tracking-widest text-xs font-bold mb-1">Most episodes watched</h3>
                                    <p className="text-lg font-bold text-white leading-tight">
                                        <span className="text-blue-400">{stats.topShowByEpisodes.count} episodes</span> of {stats.topShowByEpisodes.title}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 6. TECH STATS (Redesigned) */}
                    <div className="flex flex-col gap-8">
                        {/* The ISP Enemy (Replaces The Retro Nightmare) */}
                        {/* The ISP Enemy (Removed duplicate) */}

                        {/* Transcoded -> The Toast Index */}
                        <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 flex items-center gap-6 hover:border-orange-500/50 transition">
                            <div className="text-4xl text-orange-400 bg-orange-900/10 p-4 rounded-full flex-shrink-0">🍞</div>
                            <div>
                                <h3 className="text-slate-400 uppercase tracking-widest text-xs font-bold mb-1">The Toast Index</h3>
                                <p className="text-lg font-bold text-white leading-tight">
                                    Your device refused to do the work, so the server had to. You forced the server's CPU to generate enough heat to toast <span className="text-orange-400">{Math.round(((stats.totalSeconds / 3600) * (stats.techStats.transcodePercent / 100) * 0.1) / 0.03).toLocaleString()} slices</span> of bread.
                                    <br /><span className="text-sm font-normal text-slate-500 italic opacity-50">Say sorry to the admin.</span>
                                </p>
                            </div>
                        </div>

                        {/* Top Devices */}
                        <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center gap-6 hover:border-indigo-500/50 transition">
                            <div className="flex items-center gap-6 mb-4 md:mb-0">
                                <div className="text-4xl text-indigo-400 bg-indigo-900/10 p-4 rounded-full flex-shrink-0">🖥️</div>
                                <h3 className="text-slate-400 uppercase tracking-widest text-xs font-bold md:hidden">Top Devices</h3>
                            </div>

                            <div className="flex-1 w-full">
                                <h3 className="text-slate-400 uppercase tracking-widest text-xs font-bold mb-3 hidden md:block">Top Devices</h3>
                                <div className="space-y-3 w-full">
                                    {stats.techStats.topPlatforms.map((p, i) => (
                                        <div key={i} className="flex justify-between items-center text-sm border-b border-slate-800/50 pb-2 last:border-0 last:pb-0">
                                            <span className="text-slate-300 font-medium truncate">{p.platform}</span>
                                            <span className="text-indigo-400 font-bold bg-indigo-900/20 px-2 py-0.5 rounded text-xs">{p.count} plays</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>


                </section>





            </main>
        </div >
    );
}
