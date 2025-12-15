import { StatsResult } from '@/lib/services/stats';

interface ComparisonChartProps {
    comparison: NonNullable<StatsResult['comparison']>;
}

export function ComparisonChart({ comparison }: ComparisonChartProps) {
    const { you, average, top, bottom, leaderboard } = comparison;

    // Determine max value for scaling (min 1 hour to avoid div by zero)
    // Use the leaderboard's top user or fallback to known max
    const maxVal = leaderboard && leaderboard.length > 0 ? leaderboard[0].seconds : top.seconds;
    const max = Math.max(maxVal, 3600);

    const getPercent = (val: number) => Math.round((val / max) * 100);
    const getHours = (val: number) => Math.round(val / 3600);

    // If we have a leaderboard, use it. Otherwise fall back to the old 4 metrics.
    const hasLeaderboard = leaderboard && leaderboard.length > 0;

    const displayMetrics = hasLeaderboard
        ? leaderboard.map(u => ({
            label: u.label,
            data: { seconds: u.seconds },
            color: u.isYou ? "bg-emerald-500" : "bg-slate-700",
            text: u.isYou ? "text-emerald-400 font-bold" : "text-slate-400",
            icon: u.isYou ? "🫵" : "👤",
            isYou: u.isYou
        }))
        : [
            { label: top.label, data: top, color: "bg-purple-500", text: "text-purple-400", icon: "👑", isYou: false },
            { label: "You", data: you, color: "bg-emerald-500", text: "text-emerald-400", icon: "", isYou: true },
            { label: "Average", data: average, color: "bg-blue-500", text: "text-blue-400", icon: "", isYou: false },
            { label: bottom?.label || "Lowest", data: bottom || { seconds: 0 }, color: "bg-slate-600", text: "text-slate-500", icon: "🕸️", isYou: false }
        ];

    // Inject Average into the list if it's the leaderboard
    // Filter out "Average" logic if needed, but showing a line for Average is nice.
    // For now, let's just show the users as requested.

    return (
        <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 hover:border-slate-700 transition group h-full flex flex-col">
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h3 className="text-slate-400 uppercase tracking-widest text-sm font-bold mb-1">Peer Comparison</h3>
                    <p className="text-white text-xl font-bold">Leaderboard</p>
                </div>
                <div className="text-3xl opacity-20 group-hover:opacity-100 transition">🏆</div>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar max-h-[400px]">
                {displayMetrics.map((m, i) => (
                    <div key={i} className={`space-y-1 ${m.isYou ? 'bg-emerald-500/5 p-3 rounded-xl border border-emerald-500/20' : ''}`}>
                        <div className="flex justify-between text-xs md:text-sm">
                            <span className={`${m.text} flex items-center gap-2 truncate max-w-[70%]`}>
                                <span className="opacity-50 font-mono text-[10px] w-4">{i + 1}.</span>
                                {m.icon} {m.label}
                            </span>
                            <span className="text-slate-300 font-mono">{getHours(m.data.seconds).toLocaleString()}h</span>
                        </div>
                        <div className="h-2 bg-slate-800 rounded-full overflow-hidden relative">
                            <div
                                className={`h-full ${m.color} rounded-full transition-all duration-1000 ease-out`}
                                style={{ width: `${getPercent(m.data.seconds)}%` }}
                            ></div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800 flex justify-between items-center text-xs text-slate-500">
                <span>Average: <span className="text-blue-400 font-bold">{getHours(average.seconds)}h</span></span>
                <span className="italic">
                    {you.seconds > average.seconds ? "Above Avg 📈" : "Below Avg 📉"}
                </span>
            </div>
        </div>
    );
}
