export type GameFormat = {
  /** Best-of-N: a match is played until one side wins (N + 1) / 2 games. Always odd. */
  gamesPerMatch: number;
  pointsPerGame: number;
};

/** BWF standard: best of 3 games to 21 points. */
export const DEFAULT_GAME_FORMAT: GameFormat = { gamesPerMatch: 3, pointsPerGame: 21 };

export const ALLOWED_GAMES_PER_MATCH = [1, 3, 5, 7] as const;
export const MIN_POINTS_PER_GAME = 5;
export const MAX_POINTS_PER_GAME = 50;

/** A game is won by 2 points, but never goes past target + this margin (BWF: 21 -> 30). */
const GAME_CAP_MARGIN = 9;

export const CUSTOM_GAME_FORMAT_KEY = "CUSTOM";

export const GAME_FORMAT_PRESETS = [
  {
    key: "BWF_BEST_OF_3_21",
    label: "Best of 3 games to 21 points (BWF standard)",
    format: { gamesPerMatch: 3, pointsPerGame: 21 },
  },
  {
    key: "SINGLE_GAME_21",
    label: "1 game to 21 points",
    format: { gamesPerMatch: 1, pointsPerGame: 21 },
  },
  {
    key: "BEST_OF_3_15",
    label: "Best of 3 games to 15 points",
    format: { gamesPerMatch: 3, pointsPerGame: 15 },
  },
] as const;

export function gamesToWin(format: GameFormat): number {
  return (format.gamesPerMatch + 1) / 2;
}

export function gameScoreCap(pointsPerGame: number): number {
  return pointsPerGame + GAME_CAP_MARGIN;
}

export function isValidGameFormat(format: GameFormat): boolean {
  return (
    (ALLOWED_GAMES_PER_MATCH as readonly number[]).includes(format.gamesPerMatch) &&
    Number.isInteger(format.pointsPerGame) &&
    format.pointsPerGame >= MIN_POINTS_PER_GAME &&
    format.pointsPerGame <= MAX_POINTS_PER_GAME
  );
}

export function describeGameFormat(format: GameFormat): string {
  const games = format.gamesPerMatch === 1 ? "1 game" : `Best of ${format.gamesPerMatch} games`;
  return `${games} to ${format.pointsPerGame} points`;
}

/** The preset key matching this format exactly, or CUSTOM if none does. */
export function presetKeyFor(format: GameFormat): string {
  const preset = GAME_FORMAT_PRESETS.find(
    (p) => p.format.gamesPerMatch === format.gamesPerMatch && p.format.pointsPerGame === format.pointsPerGame,
  );
  return preset?.key ?? CUSTOM_GAME_FORMAT_KEY;
}

export type EventGameFormatFields = {
  drawFormat: string;
  gamesPerMatch: number;
  pointsPerGame: number;
  knockoutGamesPerMatch: number | null;
  knockoutPointsPerGame: number | null;
};

/**
 * The rules that apply to one match. Every event has one game format, except
 * pools+knockout, which has one for the pool stage (the event's main format)
 * and can have a different one for the knockout stage — pool-stage matches
 * always carry a poolId, knockout ones never do.
 */
export function gameFormatForMatch(event: EventGameFormatFields, match: { poolId: string | null }): GameFormat {
  const main = { gamesPerMatch: event.gamesPerMatch, pointsPerGame: event.pointsPerGame };
  if (event.drawFormat !== "POOLS_KNOCKOUT" || match.poolId !== null) return main;
  return {
    gamesPerMatch: event.knockoutGamesPerMatch ?? main.gamesPerMatch,
    pointsPerGame: event.knockoutPointsPerGame ?? main.pointsPerGame,
  };
}

export function describeEventGameFormats(event: EventGameFormatFields): string {
  const main = gameFormatForMatch(event, { poolId: "pool" });
  if (event.drawFormat !== "POOLS_KNOCKOUT") return describeGameFormat(main);
  const knockout = gameFormatForMatch(event, { poolId: null });
  return `Pool stage: ${describeGameFormat(main)} · Knockout stage: ${describeGameFormat(knockout)}`;
}
