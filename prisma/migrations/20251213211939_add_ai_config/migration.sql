-- AlterTable
ALTER TABLE "User" ADD COLUMN "statsCache" TEXT;
ALTER TABLE "User" ADD COLUMN "statsGeneratedAt" DATETIME;

-- CreateTable
CREATE TABLE "AiConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "apiKey" TEXT,
    "model" TEXT NOT NULL DEFAULT 'gpt-4o',
    "instructions" TEXT
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_username_key" ON "AdminUser"("username");
