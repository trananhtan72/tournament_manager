-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "firstServer" INTEGER,
ADD COLUMN     "liveStartedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "MatchPoint" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "side" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchPoint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MatchPoint_matchId_seq_key" ON "MatchPoint"("matchId", "seq");

-- AddForeignKey
ALTER TABLE "MatchPoint" ADD CONSTRAINT "MatchPoint_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

