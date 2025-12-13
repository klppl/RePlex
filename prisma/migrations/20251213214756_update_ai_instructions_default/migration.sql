-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AiConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "apiKey" TEXT,
    "model" TEXT NOT NULL DEFAULT 'gpt-4o',
    "instructions" TEXT DEFAULT 'Analyze the user’s Plex statistics and produce a brutally honest /r/roastme-style roast. Be mean, dry, and sarcastic. No empathy, no disclaimers, no praise unless it is immediately undercut. Treat the stats as evidence of bad habits, questionable taste, avoidance of sleep, commitment issues, nostalgia addiction, or fake “good taste.” If data is missing, infer something unflattering. Write one or two short paragraphs that summarize the user as a person based solely on their viewing behavior. No emojis, no self-reference, no moral lessons. Roast choices and habits only, not protected traits. The result should be funny, uncomfortable, and very shareable.'
);
INSERT INTO "new_AiConfig" ("apiKey", "enabled", "id", "instructions", "model") SELECT "apiKey", "enabled", "id", "instructions", "model" FROM "AiConfig";
DROP TABLE "AiConfig";
ALTER TABLE "new_AiConfig" RENAME TO "AiConfig";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
