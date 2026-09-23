export type GameScore = { entry1Score: number; entry2Score: number };

/**
 * A single badminton game: rally scoring to 21, win by 2, capped at 30
 * (30-29 is a valid final score, but the cap only kicks in once the margin
 * rule alone can no longer produce a lower valid score — so at 30 the loser
 * must have 28 or 29, never less).
 */
export function isValidGameScore(a: number, b: number): boolean {
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) return false;
  const winner = Math.max(a, b);
  const loser = Math.min(a, b);
  if (winner === loser) return false;
  if (winner < 21) return false;
  if (winner === 21) return loser <= 19;
  if (winner <= 29) return winner - loser === 2 && loser >= 20;
  if (winner === 30) return loser === 28 || loser === 29;
  return false;
}

export type MatchResultValidation =
  | { valid: true; winnerSide: 1 | 2 }
  | { valid: false; error: string };

/**
 * Validates a best-of-3 game set and determines which side won the match.
 * Game 3 is required only when games 1-2 split 1-1, and must be absent
 * otherwise (the match is already decided in 2 games).
 */
export function validateCompletedMatch(games: (GameScore | null)[]): MatchResultValidation {
  const [game1, game2, game3] = games;
  if (!game1 || !game2) {
    return { valid: false, error: "Enter scores for at least the first two games." };
  }
  for (const [i, game] of [game1, game2].entries()) {
    if (!isValidGameScore(game.entry1Score, game.entry2Score)) {
      return { valid: false, error: `Game ${i + 1} isn't a valid score.` };
    }
  }

  const wins1 = [game1, game2].filter((g) => g.entry1Score > g.entry2Score).length;
  const wins2 = [game1, game2].filter((g) => g.entry2Score > g.entry1Score).length;

  if (wins1 === 2 || wins2 === 2) {
    if (game3) {
      return { valid: false, error: "The match was already decided in 2 games — remove game 3." };
    }
    return { valid: true, winnerSide: wins1 === 2 ? 1 : 2 };
  }

  // Split 1-1: game 3 is required.
  if (!game3) {
    return { valid: false, error: "Games 1-2 are split 1-1 — enter game 3." };
  }
  if (!isValidGameScore(game3.entry1Score, game3.entry2Score)) {
    return { valid: false, error: "Game 3 isn't a valid score." };
  }
  return { valid: true, winnerSide: game3.entry1Score > game3.entry2Score ? 1 : 2 };
}
