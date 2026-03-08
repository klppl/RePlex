export function computeDuration(splitAgg: { mediaType: string; _sum: { duration: number | null; fileSize: bigint | number | null } }[]) {
    let movieSeconds = 0;
    let showSeconds = 0;
    let totalBandwidth = 0;

    splitAgg.forEach(c => {
        const s = c._sum.duration || 0;
        const size = Number(c._sum.fileSize || 0); // BigInt to Number (safe for display, might lose precision for petabytes but fine here)

        if (c.mediaType === 'movie') movieSeconds += s;
        else if (c.mediaType === 'episode') showSeconds += s;

        totalBandwidth += size;
    });
    const totalSeconds = movieSeconds + showSeconds;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const totalDuration = `${hours}h ${minutes}m`;

    return { totalDuration, totalSeconds, movieSeconds, showSeconds, totalBandwidth };
}
