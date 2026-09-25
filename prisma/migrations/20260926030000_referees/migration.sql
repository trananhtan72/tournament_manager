-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "refereeId" TEXT;

-- CreateTable
CREATE TABLE "TournamentReferee" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TournamentReferee_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TournamentReferee_userId_idx" ON "TournamentReferee"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentReferee_tournamentId_userId_key" ON "TournamentReferee"("tournamentId", "userId");

-- AddForeignKey
ALTER TABLE "TournamentReferee" ADD CONSTRAINT "TournamentReferee_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentReferee" ADD CONSTRAINT "TournamentReferee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_refereeId_fkey" FOREIGN KEY ("refereeId") REFERENCES "TournamentReferee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

