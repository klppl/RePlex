export function computeGenres(allGenresRaw: { genres: string | null }[]) {
    const genreCounts: Record<string, number> = {};
    let totalGenreTags = 0;
    allGenresRaw.forEach(row => {
        if (!row.genres) return;
        row.genres.split(',').forEach(g => {
            const genre = g.trim();
            if (genre) {
                genreCounts[genre] = (genreCounts[genre] || 0) + 1;
                totalGenreTags++;
            }
        });
    });

    const genreWheel = Object.entries(genreCounts)
        .map(([genre, count]) => ({ genre, percentage: Math.round((count / totalGenreTags) * 100) }))
        .sort((a, b) => b.percentage - a.percentage)
        .slice(0, 5); // Top 5

    return genreWheel;
}
