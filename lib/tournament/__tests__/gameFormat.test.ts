import { describe, it, expect } from "vitest";
import {
  DEFAULT_GAME_FORMAT,
  GAME_FORMAT_PRESETS,
  CUSTOM_GAME_FORMAT_KEY,
  gamesToWin,
  gameScoreCap,
  isValidGameFormat,
  describeGameFormat,
  presetKeyFor,
  gameFormatForMatch,
  describeEventGameFormats,
  type EventGameFormatFields,
} from "../gameFormat";

describe("game format basics", () => {
  it("defaults to the BWF standard: best of 3 to 21", () => {
    expect(DEFAULT_GAME_FORMAT).toEqual({ gamesPerMatch: 3, pointsPerGame: 21 });
    expect(GAME_FORMAT_PRESETS[0].format).toEqual(DEFAULT_GAME_FORMAT);
  });

  it("needs a majority of games to win", () => {
    expect(gamesToWin({ gamesPerMatch: 1, pointsPerGame: 21 })).toBe(1);
    expect(gamesToWin({ gamesPerMatch: 3, pointsPerGame: 21 })).toBe(2);
    expect(gamesToWin({ gamesPerMatch: 5, pointsPerGame: 21 })).toBe(3);
  });

  it("caps a game 9 points above the target (BWF: 21 -> 30)", () => {
    expect(gameScoreCap(21)).toBe(30);
    expect(gameScoreCap(15)).toBe(24);
  });

  it("validates custom formats: odd game counts, bounded points", () => {
    expect(isValidGameFormat({ gamesPerMatch: 3, pointsPerGame: 21 })).toBe(true);
    expect(isValidGameFormat({ gamesPerMatch: 2, pointsPerGame: 21 })).toBe(false);
    expect(isValidGameFormat({ gamesPerMatch: 9, pointsPerGame: 21 })).toBe(false);
    expect(isValidGameFormat({ gamesPerMatch: 3, pointsPerGame: 4 })).toBe(false);
    expect(isValidGameFormat({ gamesPerMatch: 3, pointsPerGame: 51 })).toBe(false);
    expect(isValidGameFormat({ gamesPerMatch: 3, pointsPerGame: 11.5 })).toBe(false);
  });

  it("describes formats in plain words", () => {
    expect(describeGameFormat({ gamesPerMatch: 3, pointsPerGame: 21 })).toBe("Best of 3 games to 21 points");
    expect(describeGameFormat({ gamesPerMatch: 1, pointsPerGame: 21 })).toBe("1 game to 21 points");
  });

  it("maps a format back to its preset, or CUSTOM", () => {
    expect(presetKeyFor({ gamesPerMatch: 3, pointsPerGame: 21 })).toBe(GAME_FORMAT_PRESETS[0].key);
    expect(presetKeyFor({ gamesPerMatch: 1, pointsPerGame: 21 })).toBe(GAME_FORMAT_PRESETS[1].key);
    expect(presetKeyFor({ gamesPerMatch: 5, pointsPerGame: 11 })).toBe(CUSTOM_GAME_FORMAT_KEY);
  });
});

describe("gameFormatForMatch", () => {
  const base: EventGameFormatFields = {
    drawFormat: "SINGLE_ELIMINATION",
    gamesPerMatch: 3,
    pointsPerGame: 21,
    knockoutGamesPerMatch: null,
    knockoutPointsPerGame: null,
  };

  it("uses the event's one format for single elimination and round robin", () => {
    expect(gameFormatForMatch(base, { poolId: null })).toEqual({ gamesPerMatch: 3, pointsPerGame: 21 });
    expect(gameFormatForMatch({ ...base, drawFormat: "ROUND_ROBIN", gamesPerMatch: 1 }, { poolId: null })).toEqual({
      gamesPerMatch: 1,
      pointsPerGame: 21,
    });
  });

  it("splits pools+knockout into a pool-stage and a knockout-stage format", () => {
    const event: EventGameFormatFields = {
      drawFormat: "POOLS_KNOCKOUT",
      gamesPerMatch: 1,
      pointsPerGame: 21,
      knockoutGamesPerMatch: 3,
      knockoutPointsPerGame: 15,
    };
    expect(gameFormatForMatch(event, { poolId: "pool-a" })).toEqual({ gamesPerMatch: 1, pointsPerGame: 21 });
    expect(gameFormatForMatch(event, { poolId: null })).toEqual({ gamesPerMatch: 3, pointsPerGame: 15 });
  });

  it("falls back to the pool-stage format when no knockout format is set", () => {
    const event: EventGameFormatFields = { ...base, drawFormat: "POOLS_KNOCKOUT", gamesPerMatch: 5, pointsPerGame: 11 };
    expect(gameFormatForMatch(event, { poolId: null })).toEqual({ gamesPerMatch: 5, pointsPerGame: 11 });
  });

  it("describes both stages for pools+knockout", () => {
    const event: EventGameFormatFields = {
      drawFormat: "POOLS_KNOCKOUT",
      gamesPerMatch: 1,
      pointsPerGame: 21,
      knockoutGamesPerMatch: 3,
      knockoutPointsPerGame: 21,
    };
    expect(describeEventGameFormats(event)).toBe(
      "Pool stage: 1 game to 21 points · Knockout stage: Best of 3 games to 21 points",
    );
    expect(describeEventGameFormats(base)).toBe("Best of 3 games to 21 points");
  });
});
