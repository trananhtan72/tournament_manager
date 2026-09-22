-- CreateEnum
CREATE TYPE "EventCategory" AS ENUM ('SINGLES', 'DOUBLES');

-- Add new columns as nullable so existing rows aren't rejected
ALTER TABLE "Event" ADD COLUMN "name" TEXT;
ALTER TABLE "Event" ADD COLUMN "category" "EventCategory";

-- Backfill from the old fixed "type" enum before it's dropped
UPDATE "Event" SET
  "name" = CASE "type"
    WHEN 'MS' THEN 'Men''s Singles'
    WHEN 'WS' THEN 'Women''s Singles'
    WHEN 'MD' THEN 'Men''s Doubles'
    WHEN 'WD' THEN 'Women''s Doubles'
    WHEN 'XD' THEN 'Mixed Doubles'
  END,
  "category" = CASE "type"
    WHEN 'MS' THEN 'SINGLES'::"EventCategory"
    WHEN 'WS' THEN 'SINGLES'::"EventCategory"
    ELSE 'DOUBLES'::"EventCategory"
  END;

-- Now that every row is backfilled, make the columns required
ALTER TABLE "Event" ALTER COLUMN "name" SET NOT NULL;
ALTER TABLE "Event" ALTER COLUMN "category" SET NOT NULL;

-- DropIndex
DROP INDEX "Event_tournamentId_type_key";

-- Drop the old fixed-type column and enum
ALTER TABLE "Event" DROP COLUMN "type";
DROP TYPE "EventType";

-- CreateIndex
CREATE UNIQUE INDEX "Event_tournamentId_name_key" ON "Event"("tournamentId", "name");
