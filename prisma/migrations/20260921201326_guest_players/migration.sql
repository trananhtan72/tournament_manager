-- DropForeignKey
ALTER TABLE "EntryPlayer" DROP CONSTRAINT "EntryPlayer_userId_fkey";

-- AlterTable
ALTER TABLE "EntryPlayer" ADD COLUMN     "guestName" TEXT,
ALTER COLUMN "userId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "EntryPlayer" ADD CONSTRAINT "EntryPlayer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
