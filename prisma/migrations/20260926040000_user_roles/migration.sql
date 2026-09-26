-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'ORGANIZER', 'USER');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'USER';

-- Make the app's administrator account an admin, if it already has an
-- account here. (lib/roles.ts also grants ADMIN to a fresh signup with
-- this email, so this backfill only matters for an account that predates
-- this migration.)
UPDATE "User" SET "role" = 'ADMIN' WHERE lower("email") = 'tea@gmail.com';

