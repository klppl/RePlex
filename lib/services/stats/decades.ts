export function computeDecades(decadesRaw: { year: number | null }[]) {
    const decadeCounts: Record<string, number> = {};
    decadesRaw.forEach(r => {
        if (!r.year) return;
        const decade = Math.floor(r.year / 10) * 10;
        const key = `${decade}s`;
        decadeCounts[key] = (decadeCounts[key] || 0) + 1;
    });

    const sortedDecades = Object.entries(decadeCounts).sort((a, b) => b[1] - a[1]);
    const timeTraveler = sortedDecades.length > 0 ? { decade: sortedDecades[0][0], count: sortedDecades[0][1] } : { decade: "N/A", count: 0 };

    // Your Media Age (Average Year)
    const totalYears = decadesRaw.reduce((sum, r) => sum + (r.year || 0), 0);
    const averageYear = decadesRaw.length > 0 ? Math.round(totalYears / decadesRaw.length) : new Date().getFullYear();

    return { timeTraveler, averageYear };
}
