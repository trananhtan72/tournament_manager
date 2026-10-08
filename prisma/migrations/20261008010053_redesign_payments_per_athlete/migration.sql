-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'ZELLE', 'OTHER');

-- AlterTable
ALTER TABLE "EntryPlayer" DROP COLUMN "amountDue",
DROP COLUMN "paidAt",
DROP COLUMN "paymentMethod",
DROP COLUMN "paymentNotes",
DROP COLUMN "paymentStatus";

-- DropEnum
DROP TYPE "PaymentStatus";

-- CreateTable
CREATE TABLE "TournamentPayment" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "userId" TEXT,
    "guestName" TEXT,
    "amount" DECIMAL(10,2),
    "method" "PaymentMethod",
    "note" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TournamentPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TournamentPayment_tournamentId_userId_key" ON "TournamentPayment"("tournamentId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentPayment_tournamentId_guestName_key" ON "TournamentPayment"("tournamentId", "guestName");

-- AddForeignKey
ALTER TABLE "TournamentPayment" ADD CONSTRAINT "TournamentPayment_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentPayment" ADD CONSTRAINT "TournamentPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

