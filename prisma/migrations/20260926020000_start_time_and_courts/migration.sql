-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "startedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Tournament" ADD COLUMN     "courtCount" INTEGER NOT NULL DEFAULT 12;

