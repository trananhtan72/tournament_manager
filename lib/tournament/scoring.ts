import { DEFAULT_GAME_FORMAT, gameScoreCap, gamesToWin, type GameFormat } from "./gameFormat";

export type GameScore = { entry1Score: number; entry2Score: number };

/**
 * A single badminton game: rally scoring to `pointsPerGame`, win by 2, capped
 * at gameScoreCap (BWF: 21 -> 30, where 30-29 is a valid final score). The cap
 * only kicks in once the margin rule alone can no longer produce a lower valid
 * score, so at the cap the loser must be 1 or 2 short of it, never less.
 */
export function isValidGameScore(
  a: number,
  b: number,
  pointsPerGame: number = DEFAULT_GAME_FORMAT.pointsPerGame,
): boolean {
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) return false;
  const cap = gameScoreCap(pointsPerGame);
  const winner = Math.max(a, b);
  const loser = Math.min(a, b);
  if (winner === loser) return false;
  if (winner < pointsPerGame) return false;
  if (winner === pointsPerGame) return loser <= pointsPerGame - 2;
  if (winner < cap) return winner - loser === 2;
  if (winner === cap) return loser === cap - 1 || loser === cap - 2;
  return false;
}

export type MatchResultValidation =
  | { valid: true; winnerSide: 1 | 2 }
  | { valid: false; error: string };

/**
 * Validates a best-of-N game set and determines which side won the match.
 * Games are read in order; once a side has won enough games the match is
 * over, so any later game must be absent, and every game before that point
 * must be present.
 */
export function validateCompletedMatch(
  games: (GameScore | null)[],
  format: GameFormat = DEFAULT_GAME_FORMAT,
): MatchResultValidation {
  const needed = gamesToWin(format);
  const cap = gameScoreCap(format.pointsPerGame);
  let wins1 = 0;
  let wins2 = 0;

  for (let i = 0; i < format.gamesPerMatch; i++) {
    const game = games[i] ?? null;

    if (wins1 === needed || wins2 === needed) {
      if (game) {
        return { valid: false, error: `The match was already decided after ${i} games — remove game ${i + 1}.` };
      }
      continue;
    }

    if (!game) {
      return {
        valid: false,
        error:
          i < needed
            ? `Enter a score for game ${i + 1}.`
            : `Games are ${wins1}-${wins2} — enter game ${i + 1}.`,
      };
    }
    if (!isValidGameScore(game.entry1Score, game.entry2Score, format.pointsPerGame)) {
      return {
        valid: false,
        error: `Game ${i + 1} isn't a valid score — games go to ${format.pointsPerGame}, win by 2, capped at ${cap}.`,
      };
    }
    if (game.entry1Score > game.entry2Score) wins1++;
    else wins2++;
  }

  if (games.slice(format.gamesPerMatch).some((g) => g !== null)) {
    return { valid: false, error: `This match is best of ${format.gamesPerMatch} — extra games aren't allowed.` };
  }

  if (wins1 === needed) return { valid: true, winnerSide: 1 };
  if (wins2 === needed) return { valid: true, winnerSide: 2 };
  return { valid: false, error: "The match isn't decided yet." };
}
