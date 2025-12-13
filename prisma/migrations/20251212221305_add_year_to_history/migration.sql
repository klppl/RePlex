-- CreateTable
CREATE TABLE "TautulliConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "ip" TEXT NOT NULL,
    "port" INTEGER NOT NULL,
    "apiKey" TEXT NOT NULL,
    "useSsl" BOOLEAN NOT NULL DEFAULT false,
    "rootPath" TEXT
);

-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT,
    "email" TEXT,
    "thumb" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "WatchHistory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tautulliId" INTEGER,
    "userId" INTEGER NOT NULL,
    "date" DATETIME NOT NULL,
    "duration" INTEGER NOT NULL,
    "percentComplete" INTEGER NOT NULL,
    "mediaType" TEXT NOT NULL,
    "year" INTEGER,
    "title" TEXT NOT NULL,
    "parentTitle" TEXT,
    "grandparentTitle" TEXT,
    "ratingKey" TEXT,
    "parentRatingKey" TEXT,
    "grandparentRatingKey" TEXT,
    "fullTitle" TEXT,
    CONSTRAINT "WatchHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SyncLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "date" DATETIME NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "SyncLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "WatchHistory_userId_idx" ON "WatchHistory"("userId");

-- CreateIndex
CREATE INDEX "WatchHistory_date_idx" ON "WatchHistory"("date");

-- CreateIndex
CREATE UNIQUE INDEX "SyncLog_userId_date_key" ON "SyncLog"("userId", "date");
