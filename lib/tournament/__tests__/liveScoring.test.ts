import { describe, expect, it } from "vitest";
import { completedGames, gameWinner, isSide, replayPoints, type Side } from "../liveScoring";
import { isValidGameScore, validateCompletedMatch } from "../scoring";
import type { GameFormat } from "../gameFormat";

const BWF: GameFormat = { gamesPerMatch: 3, pointsPerGame: 21 };

/** A run of rallies: rally("1x5 2x3") -> five for side 1 then three for side 2. */
function rallies(spec: string): Side[] {
  return spec
    .trim()
    .split(/\s+/)
    .flatMap((part) => {
      const [side, count] = part.split("x");
      return Array.from({ length: Number(count) }, () => Number(side) as Side);
    });
}
/** Alternates points so the score climbs level: 1,2,1,2… for `n` each. */
const level = (n: number): Side[] => Array.from({ length: n * 2 }, (_, i) => ((i % 2) + 1) as Side);

describe("gameWinner", () => {
  it("is decided at the target with a 2-point lead", () => {
    expect(gameWinner(21, 19, 21)).toBe(1);
    expect(gameWinner(15, 21, 21)).toBe(2);
    expect(gameWinner(21, 0, 21)).toBe(1);
  });

  it("is not decided at the target with a 1-point lead — play on", () => {
    expect(gameWinner(21, 20, 21)).toBeNull();
    expect(gameWinner(20, 20, 21)).toBeNull();
    expect(gameWinner(22, 21, 21)).toBeNull();
    expect(gameWinner(20, 19, 21)).toBeNull();
  });

  it("continues past the target until someone leads by 2", () => {
    expect(gameWinner(23, 21, 21)).toBe(1);
    expect(gameWinner(29, 28, 21)).toBeNull();
    expect(gameWinner(29, 29, 21)).toBeNull();
  });

  it("stops dead at the cap: 30-29 wins", () => {
    expect(gameWinner(30, 29, 21)).toBe(1);
    expect(gameWinner(29, 30, 21)).toBe(2);
    expect(gameWinner(30, 28, 21)).toBe(1);
  });

  it("scales the target and cap with the game format", () => {
    expect(gameWinner(15, 13, 15)).toBe(1);
    expect(gameWinner(15, 14, 15)).toBeNull();
    expect(gameWinner(24, 23, 15)).toBe(1); // cap is 15 + 9
    expect(gameWinner(11, 5, 11)).toBe(1);
  });

  it("recognises every final score the manual-entry rules accept", () => {
    for (const target of [11, 15, 21]) {
      for (let hi = 0; hi <= target + 9; hi++) {
        for (let lo = 0; lo < hi; lo++) {
          if (!isValidGameScore(hi, lo, target)) continue;
          expect(gameWinner(hi, lo, target)).toBe(1);
          expect(gameWinner(lo, hi, target)).toBe(2);
        }
      }
    }
  });
});

describe("replayPoints — a match in progress", () => {
  it("starts 0-0 in game 1 with the first server serving", () => {
    const s = replayPoints([], BWF, 2);
    expect(s.games).toEqual([{ number: 1, score1: 0, score2: 0, winner: null }]);
    expect(s.currentGame).toBe(1);
    expect(s.server).toBe(2);
    expect(s.matchWinner).toBeNull();
    expect(s.gamePoint).toEqual([]);
    expect(s.pointsPlayed).toBe(0);
  });

  it("counts rally points and hands the serve to each rally's winner", () => {
    const s = replayPoints(rallies("1x2 2x1"), BWF, 1);
    expect(s.games[0]).toMatchObject({ score1: 2, score2: 1 });
    expect(s.server).toBe(2);
    expect(replayPoints(rallies("1x2 2x1 1x1"), BWF, 2).server).toBe(1);
  });

  it("finishes a game at 21 and starts the next with the winner serving", () => {
    const s = replayPoints(rallies("2x5 1x21"), BWF, 1);
    expect(s.games).toEqual([
      { number: 1, score1: 21, score2: 5, winner: 1 },
      { number: 2, score1: 0, score2: 0, winner: null },
    ]);
    expect(s.gamesWon).toEqual([1, 0]);
    expect(s.currentGame).toBe(2);
    expect(s.server).toBe(1); // won the last rally of game 1, so serves first in game 2
    expect(s.matchWinner).toBeNull();
  });

  it("plays deuce: 21-20 goes on, 22-20 ends it", () => {
    const upTo20 = level(20);
    let s = replayPoints([...upTo20, 1], BWF, 1);
    expect(s.games[0]).toMatchObject({ score1: 21, score2: 20, winner: null });
    s = replayPoints([...upTo20, 1, 1], BWF, 1);
    expect(s.games[0]).toMatchObject({ score1: 22, score2: 20, winner: 1 });
  });

  it("caps at 30: a 29-29 game is decided by the next rally", () => {
    const s = replayPoints([...level(29), 2], BWF, 1);
    expect(s.games[0]).toMatchObject({ score1: 29, score2: 30, winner: 2 });
    expect(s.gamesWon).toEqual([0, 1]);
  });
});

describe("replayPoints — winning the match", () => {
  it("ends 2-0 and stops serving", () => {
    const s = replayPoints(rallies("1x21 1x21"), BWF, 2);
    expect(s.matchWinner).toBe(1);
    expect(s.gamesWon).toEqual([2, 0]);
    expect(s.games).toHaveLength(2);
    expect(s.server).toBeNull();
    expect(s.gamePoint).toEqual([]);
    expect(s.matchPoint).toEqual([]);
    expect(s.currentGame).toBe(2);
  });

  it("goes to a decider at 1-1", () => {
    const s = replayPoints(rallies("1x21 2x21"), BWF, 1);
    expect(s.matchWinner).toBeNull();
    expect(s.gamesWon).toEqual([1, 1]);
    expect(s.currentGame).toBe(3);
    expect(s.server).toBe(2);
    const done = replayPoints(rallies("1x21 2x21 2x21"), BWF, 1);
    expect(done.matchWinner).toBe(2);
    expect(done.games.map((g) => [g.score1, g.score2])).toEqual([[21, 0], [0, 21], [0, 21]]);
  });

  it("ignores rallies after the match is decided", () => {
    const s = replayPoints([...rallies("1x21 1x21"), 2, 2, 2], BWF, 1);
    expect(s.matchWinner).toBe(1);
    expect(s.pointsPlayed).toBe(42);
    expect(s.games).toHaveLength(2);
  });

  it("supports a single-game match", () => {
    const one: GameFormat = { gamesPerMatch: 1, pointsPerGame: 21 };
    const s = replayPoints(rallies("2x21"), one, 1);
    expect(s.matchWinner).toBe(2);
    expect(s.games).toHaveLength(1);
  });

  it("supports best of 5 to 11", () => {
    const bo5: GameFormat = { gamesPerMatch: 5, pointsPerGame: 11 };
    const points = rallies("1x11 2x11 1x11 2x11 1x11");
    const s = replayPoints(points, bo5, 1);
    expect(s.matchWinner).toBe(1);
    expect(s.gamesWon).toEqual([3, 2]);
    expect(s.games).toHaveLength(5);
    expect(replayPoints(points.slice(0, -1), bo5, 1).matchWinner).toBeNull();
  });
});

describe("game point and match point", () => {
  it("flags game point for the side one rally from the game", () => {
    expect(replayPoints(rallies("1x20 2x10"), BWF, 1).gamePoint).toEqual([1]);
    expect(replayPoints(rallies("1x19 2x10"), BWF, 1).gamePoint).toEqual([]);
  });

  it("has no game point at 20-20, since one rally can't win by 2", () => {
    expect(replayPoints(level(20), BWF, 1).gamePoint).toEqual([]);
  });

  it("flags game point for the leader at 21-20 and 22-21, none when level at 21-21", () => {
    expect(replayPoints([...level(20), 1], BWF, 1).gamePoint).toEqual([1]);
    expect(replayPoints(level(21), BWF, 1).gamePoint).toEqual([]);
    expect(replayPoints([...level(21), 1], BWF, 1).gamePoint).toEqual([1]);
  });

  it("gives both sides game point at 29-29 (next rally wins at the cap)", () => {
    expect(replayPoints(level(29), BWF, 1).gamePoint).toEqual([1, 2]);
  });

  it("marks match point only when that game would also win the match", () => {
    const oneGameUp = rallies("1x21 1x20");
    expect(replayPoints(oneGameUp, BWF, 1).matchPoint).toEqual([1]);
    expect(replayPoints(oneGameUp, BWF, 1).gamePoint).toEqual([1]);

    const level1All = rallies("1x21 2x21 1x20");
    const s = replayPoints(level1All, BWF, 1);
    expect(s.gamePoint).toEqual([1]);
    expect(s.matchPoint).toEqual([1]);

    // game point in game 1 is not match point
    const early = replayPoints(rallies("1x20"), BWF, 1);
    expect(early.gamePoint).toEqual([1]);
    expect(early.matchPoint).toEqual([]);
  });

  it("every single-game point that wins is match point", () => {
    const one: GameFormat = { gamesPerMatch: 1, pointsPerGame: 21 };
    expect(replayPoints(rallies("2x20"), one, 1).matchPoint).toEqual([2]);
  });
});

describe("completedGames + consistency with manual result validation", () => {
  it("lists only finished games", () => {
    const s = replayPoints(rallies("1x21 2x7"), BWF, 1);
    expect(completedGames(s)).toEqual([{ entry1Score: 21, entry2Score: 0 }]);
  });

  it("a finished live match validates as a completed manual result", () => {
    const state = replayPoints([...rallies("1x21"), ...level(20), 2, 2, ...rallies("1x21")], BWF, 1);
    expect(state.matchWinner).toBe(1);
    const games = completedGames(state);
    expect(games).toEqual([
      { entry1Score: 21, entry2Score: 0 },
      { entry1Score: 20, entry2Score: 22 },
      { entry1Score: 21, entry2Score: 0 },
    ]);
    expect(validateCompletedMatch(games, BWF)).toEqual({ valid: true, winnerSide: 1 });
  });

  it("holds for a random full match in every game format", () => {
    let seed = 12345;
    const rand = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
    for (const format of [BWF, { gamesPerMatch: 1, pointsPerGame: 21 }, { gamesPerMatch: 3, pointsPerGame: 15 }, { gamesPerMatch: 5, pointsPerGame: 11 }]) {
      for (let run = 0; run < 40; run++) {
        const points: Side[] = [];
        let state = replayPoints(points, format, 1);
        while (!state.matchWinner) {
          points.push(rand() < 0.5 ? 1 : 2);
          state = replayPoints(points, format, 1);
        }
        const result = validateCompletedMatch(completedGames(state), format);
        expect(result).toEqual({ valid: true, winnerSide: state.matchWinner });
      }
    }
  });
});

describe("isSide", () => {
  it("accepts only 1 and 2", () => {
    expect(isSide(1)).toBe(true);
    expect(isSide(2)).toBe(true);
    for (const bad of [0, 3, "1", null, undefined, 1.5]) expect(isSide(bad)).toBe(false);
  });
});
