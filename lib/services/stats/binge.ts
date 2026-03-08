import db from '../../db';
import { Prisma } from '@prisma/client';

export async function computeBingeAndCommitment(where: Prisma.WatchHistoryWhereInput) {
    const [uncommittedRaw, uncommittedCount, episodes] = await Promise.all([
        db.watchHistory.findMany({ where: { ...where, percentComplete: { lt: 20 }, mediaType: 'movie' }, select: { title: true }, take: 50 }),
        db.watchHistory.count({ where: { ...where, percentComplete: { lt: 20 }, mediaType: 'movie' } }),
        db.watchHistory.findMany({ where: { ...where, mediaType: 'episode', grandparentRatingKey: { not: null } }, orderBy: { date: 'asc' }, select: { date: true, grandparentTitle: true, duration: true } }),
    ]);
    const uncommittedTitles = uncommittedRaw.map(u => u.title);

    let maxStreak = 0;
    let currentStreak = 1;
    let bingeShow = "";
    let bingeDate = "";

    for (let i = 1; i < episodes.length; i++) {
        const prev = episodes[i - 1];
        const curr = episodes[i];

        // Check if same show
        if (prev.grandparentTitle === curr.grandparentTitle && prev.grandparentTitle) {
            // Check time gap. Did 'curr' start within 20 mins of 'prev' ending?
            // prev End = prev.date + prev.duration (secs) * 1000
            const prevEndCalls = prev.date.getTime() + (prev.duration * 1000);
            const gap = curr.date.getTime() - prevEndCalls;
            // 20 mins = 20 * 60 * 1000 = 1,200,000 ms
            if (gap >= 0 && gap < 1200000) {
                currentStreak++;
            } else {
                if (currentStreak > maxStreak) {
                    maxStreak = currentStreak;
                    bingeShow = prev.grandparentTitle;
                    bingeDate = prev.date.toDateString();
                }
                currentStreak = 1;
            }
        } else {
            if (currentStreak > maxStreak) {
                maxStreak = currentStreak;
                bingeShow = prev.grandparentTitle || "";
                bingeDate = prev.date.toDateString();
            }
            currentStreak = 1;
        }
    }
    // Check last loop
    if (currentStreak > maxStreak && episodes.length > 0) {
        maxStreak = currentStreak;
        bingeShow = episodes[episodes.length - 1].grandparentTitle || "";
        bingeDate = episodes[episodes.length - 1].date.toDateString();
    }

    const bingeRecord = maxStreak > 1 ? { show: bingeShow, count: maxStreak, date: bingeDate } : undefined;

    return { bingeRecord, commitmentIssues: { count: uncommittedCount, titles: uncommittedTitles } };
}
