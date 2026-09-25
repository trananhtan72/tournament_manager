-- AlterTable
ALTER TABLE "Tournament" DROP COLUMN "regulationsUrl",
ADD COLUMN     "regulations" JSONB;

