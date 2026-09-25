import { gameScoreCap, gamesToWin, type GameFormat } from "./gameFormat";
import type { GameScore } from "./scoring";

/** 1 = the match's first entry, 2 = its second. */
export type Side = 1 | 2;

export type LiveGame = {
  number: number;
  score1: number;
  score2: number;
  /** Set once the game is over; null for the game in progress. */
  winner: Side | null;
};

export type LiveState = {
  /** Every game started so far. The last one is in progress unless the match is over. */
  games: LiveGame[];
  gamesWon: [number, number];
  /** Number of the game being played (the last game once the match is over). */
  currentGame: number;
  matchWinner: Side | null;
  /** Who serves the next rally; null once the match is over. */
  server: Side | null;
  /** Sides that would win the current game by winning the next rally. */
  gamePoint: Side[];
  /** Sides that would win the whole match by winning the next rally. */
  matchPoint: Side[];
  pointsPlayed: number;
};

/** Who has won a game at this score, if anyone: to the target with a 2-point lead, or the cap. */
export function gameWinner(score1: number, score2: number, pointsPerGame: number): Side | null {
  const high = Math.max(score1, score2);
  const low = Math.min(score1, score2);
  const decided = high >= gameScoreCap(pointsPerGame) || (high >= pointsPerGame && high - low >= 2);
  if (!decided) return null;
  return score1 > score2 ? 1 : 2;
}

/**
 * Rebuilds the state of a match from its rallies, in order. The winner of
 * each rally serves the next (which also makes the winner of a game serve
 * first in the next one); `firstServer` serves the very first rally. Points
 * after the match is decided are ignored — callers refuse them up front.
 */
export function replayPoints(points: Side[], format: GameFormat, firstServer: Side): LiveState {
  const target = format.pointsPerGame;
  const gamesNeeded = gamesToWin(format);

  const finished: LiveGame[] = [];
  const gamesWon: [number, number] = [0, 0];
  let score1 = 0;
  let score2 = 0;
  let gameNumber = 1;
  let server: Side = firstServer;
  let matchWinner: Side | null = null;
  let pointsPlayed = 0;

  for (const side of points) {
    if (matchWinner) break;
    pointsPlayed++;
    if (side === 1) score1++;
    else score2++;
    server = side;

    const winner = gameWinner(score1, score2, target);
    if (winner) {
      finished.push({ number: gameNumber, score1, score2, winner });
      gamesWon[winner - 1]++;
      if (gamesWon[winner - 1] >= gamesNeeded) {
        matchWinner = winner;
      } else {
        gameNumber++;
        score1 = 0;
        score2 = 0;
      }
    }
  }

  if (matchWinner) {
    return {
      games: finished,
      gamesWon,
      currentGame: gameNumber,
      matchWinner,
      server: null,
      gamePoint: [],
      matchPoint: [],
      pointsPlayed,
    };
  }

  const wins = (side: Side) =>
    gameWinner(score1 + (side === 1 ? 1 : 0), score2 + (side === 2 ? 1 : 0), target) !== null;
  const gamePoint = ([1, 2] as const).filter(wins);
  const matchPoint = gamePoint.filter((side) => gamesWon[side - 1] + 1 >= gamesNeeded);

  return {
    games: [...finished, { number: gameNumber, score1, score2, winner: null }],
    gamesWon,
    currentGame: gameNumber,
    matchWinner: null,
    server,
    gamePoint,
    matchPoint,
    pointsPlayed,
  };
}

/** The finished games, in the shape a recorded result uses. */
export function completedGames(state: LiveState): GameScore[] {
  return state.games
    .filter((game) => game.winner !== null)
    .map((game) => ({ entry1Score: game.score1, entry2Score: game.score2 }));
}

export function isSide(value: unknown): value is Side {
  return value === 1 || value === 2;
}
