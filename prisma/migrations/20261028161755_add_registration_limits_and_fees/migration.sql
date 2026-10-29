-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "entryFee" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "Tournament" ADD COLUMN     "maxEventsPerUser" INTEGER NOT NULL DEFAULT 5;

