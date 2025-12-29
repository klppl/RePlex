import db from '@/lib/db';

/**
 * Determines the current reporting year based on the AppConfig.
 * If the current date is BEFORE the configured "Year Setup" date (Month/Day),
 * then the reporting year is the PREVIOUS year.
 * Otherwise, it is the CURRENT year.
 * 
 * Example:
 * Cutoff: April 30 (Month 4, Day 30)
 * Current: Jan 15, 2026 -> Returns 2025
 * Current: May 1, 2026 -> Returns 2026
 */
export async function getCurrentReportingYear(): Promise<number> {
    const now = new Date();
    const currentYear = now.getFullYear();

    try {
        const config = await db.appConfig.findFirst();

        // Default to Jan 1 if not set (Standard Calendar Year)
        const setupMonth = config?.yearSetupMonth || 1;
        const setupDay = config?.yearSetupDay || 1;

        // Create a date object for the cutoff in the current year
        // Month is 0-indexed in JS Date (0 = Jan, 3 = April)
        // config.yearSetupMonth is 1-indexed (1 = Jan, 4 = April)
        const cutoffDate = new Date(currentYear, setupMonth - 1, setupDay);

        // If we are strictly BEFORE the cutoff date, we are in the previous reporting cycle
        if (now < cutoffDate) {
            return currentYear - 1;
        }

        return currentYear;
    } catch (e) {
        console.error("Failed to fetch AppConfig for date logic, defaulting to calendar year", e);
        return currentYear;
    }
}
