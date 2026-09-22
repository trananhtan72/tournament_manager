-- AlterTable
ALTER TABLE "Event" ADD COLUMN "drawPublished" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Entry" ADD COLUMN "seed" INTEGER;

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "entry1Id" TEXT,
    "entry2Id" TEXT,
    "winnerId" TEXT,
    "isBye" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Match_eventId_round_position_key" ON "Match"("eventId", "round", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Entry_eventId_seed_key" ON "Entry"("eventId", "seed");

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_entry1Id_fkey" FOREIGN KEY ("entry1Id") REFERENCES "Entry"("id") ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_entry2Id_fkey" FOREIGN KEY ("entry2Id") REFERENCES "Entry"("id") ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "Entry"("id") ON UPDATE CASCADE;
