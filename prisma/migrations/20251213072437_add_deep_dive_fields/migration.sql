-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_WatchHistory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tautulliId" INTEGER,
    "userId" INTEGER NOT NULL,
    "date" DATETIME NOT NULL,
    "duration" INTEGER NOT NULL,
    "percentComplete" INTEGER,
    "mediaType" TEXT NOT NULL,
    "year" INTEGER,
    "actors" TEXT,
    "genres" TEXT,
    "rating" REAL,
    "transcodeDecision" TEXT,
    "player" TEXT,
    "fileSize" BIGINT,
    "title" TEXT NOT NULL,
    "parentTitle" TEXT,
    "grandparentTitle" TEXT,
    "ratingKey" TEXT,
    "parentRatingKey" TEXT,
    "grandparentRatingKey" TEXT,
    "fullTitle" TEXT,
    CONSTRAINT "WatchHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_WatchHistory" ("date", "duration", "fullTitle", "grandparentRatingKey", "grandparentTitle", "id", "mediaType", "parentRatingKey", "parentTitle", "percentComplete", "ratingKey", "tautulliId", "title", "userId", "year") SELECT "date", "duration", "fullTitle", "grandparentRatingKey", "grandparentTitle", "id", "mediaType", "parentRatingKey", "parentTitle", "percentComplete", "ratingKey", "tautulliId", "title", "userId", "year" FROM "WatchHistory";
DROP TABLE "WatchHistory";
ALTER TABLE "new_WatchHistory" RENAME TO "WatchHistory";
CREATE INDEX "WatchHistory_userId_idx" ON "WatchHistory"("userId");
CREATE INDEX "WatchHistory_date_idx" ON "WatchHistory"("date");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
