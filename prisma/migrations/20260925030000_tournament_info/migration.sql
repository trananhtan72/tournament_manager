-- AlterTable
ALTER TABLE "Tournament" ADD COLUMN     "registrationOpensAt" TIMESTAMP(3),
ADD COLUMN     "regulationsUrl" TEXT,
ADD COLUMN     "withdrawalDeadline" TIMESTAMP(3);

