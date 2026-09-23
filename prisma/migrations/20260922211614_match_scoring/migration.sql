-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('COMPLETED', 'WALKOVER', 'RETIRED');

-- DropForeignKey
ALTER TABLE "Match" DROP CONSTRAINT "Match_entry1Id_fkey";

-- DropForeignKey
ALTER TABLE "Match" DROP CONSTRAINT "Match_entry2Id_fkey";

-- DropForeignKey
ALTER TABLE "Match" DROP CONSTRAINT "Match_winnerId_fkey";

-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "status" "MatchStatus";

-- CreateTable
CREATE TABLE "MatchGame" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "gameNumber" INTEGER NOT NULL,
    "entry1Score" INTEGER NOT NULL,
    "entry2Score" INTEGER NOT NULL,

    CONSTRAINT "MatchGame_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MatchGame_matchId_gameNumber_key" ON "MatchGame"("matchId", "gameNumber");

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_entry1Id_fkey" FOREIGN KEY ("entry1Id") REFERENCES "Entry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_entry2Id_fkey" FOREIGN KEY ("entry2Id") REFERENCES "Entry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "Entry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchGame" ADD CONSTRAINT "MatchGame_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
