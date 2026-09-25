-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "gamesPerMatch" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "knockoutGamesPerMatch" INTEGER,
ADD COLUMN     "knockoutPointsPerGame" INTEGER,
ADD COLUMN     "pointsPerGame" INTEGER NOT NULL DEFAULT 21;

