-- CreateEnum
CREATE TYPE "TieSlotType" AS ENUM ('SINGLES', 'DOUBLES');

-- AlterEnum
ALTER TYPE "EventCategory" ADD VALUE 'TEAM';

-- DropIndex
DROP INDEX "EntryPlayer_eventId_userId_key";

-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "gamesPerMatch" INTEGER,
ADD COLUMN     "pointsPerGame" INTEGER,
ADD COLUMN     "tieId" TEXT,
ADD COLUMN     "tieSlotLabel" TEXT;

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "entryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMember" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT,
    "guestName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TieFormatSlot" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "type" "TieSlotType" NOT NULL,
    "gamesPerMatch" INTEGER NOT NULL,
    "pointsPerGame" INTEGER NOT NULL,

    CONSTRAINT "TieFormatSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tie" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "team1Id" TEXT,
    "team2Id" TEXT,
    "winnerId" TEXT,
    "isBye" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tie_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Team_entryId_key" ON "Team"("entryId");

-- CreateIndex
CREATE UNIQUE INDEX "Team_eventId_name_key" ON "Team"("eventId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "TieFormatSlot_eventId_order_key" ON "TieFormatSlot"("eventId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "Tie_eventId_round_position_key" ON "Tie"("eventId", "round", "position");

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "Entry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TieFormatSlot" ADD CONSTRAINT "TieFormatSlot_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tie" ADD CONSTRAINT "Tie_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tie" ADD CONSTRAINT "Tie_team1Id_fkey" FOREIGN KEY ("team1Id") REFERENCES "Entry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tie" ADD CONSTRAINT "Tie_team2Id_fkey" FOREIGN KEY ("team2Id") REFERENCES "Entry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tie" ADD CONSTRAINT "Tie_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "Entry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_tieId_fkey" FOREIGN KEY ("tieId") REFERENCES "Tie"("id") ON DELETE CASCADE ON UPDATE CASCADE;
