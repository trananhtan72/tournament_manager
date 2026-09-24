import { describe, it, expect } from "vitest";
import {
  generateRoundRobinMatches,
  computeRoundRobinStandings,
  type StandingsMatchInput,
} from "../roundRobin";

describe("generateRoundRobinMatches", () => {
  it("pairs every entry with every other entry exactly once", () => {
    const matches = generateRoundRobinMatches(["a", "b", "c", "d"]);
    expect(matches).toHaveLength(6); // 4 choose 2

    const pairsSeen = new Set(matches.map((m) => [m.entry1Id, m.entry2Id].sort().join(":")));
    expect(pairsSeen.size).toBe(6);

    for (const id of ["a", "b", "c", "d"]) {
      const appearances = matches.filter((m) => m.entry1Id === id || m.entry2Id === id);
      expect(appearances).toHaveLength(3); // plays each of the other 3 once
    }
  });

  it("assigns unique sequential positions", () => {
    const matches = generateRoundRobinMatches(["a", "b", "c"]);
    expect(matches.map((m) => m.position)).toEqual([0, 1, 2]);
  });

  it("produces no matches for a single entry", () => {
    expect(generateRoundRobinMatches(["a"])).toEqual([]);
  });
});

function playedMatch(
  entry1Id: string,
  entry2Id: string,
  winnerId: string,
  games: [number, number][],
): StandingsMatchInput {
  return {
    entry1Id,
    entry2Id,
    winnerId,
    games: games.map(([entry1Score, entry2Score]) => ({ entry1Score, entry2Score })),
  };
}

describe("computeRoundRobinStandings", () => {
  it("ranks purely by wins when there are no ties", () => {
    // A beats everyone, B beats C and D, C beats D, D loses all.
    const matches: StandingsMatchInput[] = [
      playedMatch("A", "B", "A", [[21, 15], [21, 18]]),
      playedMatch("A", "C", "A", [[21, 10], [21, 12]]),
      playedMatch("A", "D", "A", [[21, 5], [21, 8]]),
      playedMatch("B", "C", "B", [[21, 19], [21, 17]]),
      playedMatch("B", "D", "B", [[21, 10], [21, 11]]),
      playedMatch("C", "D", "C", [[21, 15], [21, 16]]),
    ];
    const standings = computeRoundRobinStandings(["A", "B", "C", "D"], matches);
    expect(standings.map((s) => s.entryId)).toEqual(["A", "B", "C", "D"]);
    expect(standings.map((s) => s.rank)).toEqual([1, 2, 3, 4]);
    expect(standings[0].wins).toBe(3);
    expect(standings[3].wins).toBe(0);
  });

  it("breaks a clean 2-way tie by head-to-head result, even when it contradicts game/point difference", () => {
    // A and B both finish 2-1 (a tie separate from C/D, who finish 1-2), but
    // B beat A head-to-head. A has a far better game/point difference
    // overall (blowout wins over C and D) — if head-to-head weren't checked
    // first, A would wrongly rank above B on point difference instead.
    const matches: StandingsMatchInput[] = [
      playedMatch("A", "B", "B", [[19, 21], [19, 21]]),
      playedMatch("A", "C", "A", [[21, 2], [21, 2]]),
      playedMatch("A", "D", "A", [[21, 2], [21, 2]]),
      playedMatch("B", "C", "B", [[21, 15], [21, 16]]),
      playedMatch("B", "D", "D", [[15, 21], [16, 21]]),
      playedMatch("C", "D", "C", [[21, 18], [21, 19]]),
    ];
    const standings = computeRoundRobinStandings(["A", "B", "C", "D"], matches);
    const byId = Object.fromEntries(standings.map((s) => [s.entryId, s]));
    expect(byId.A.wins).toBe(2);
    expect(byId.B.wins).toBe(2);
    // Confirm the point-difference trap is real: A's is much better than B's.
    expect(byId.A.pointsWon - byId.A.pointsLost).toBeGreaterThan(byId.B.pointsWon - byId.B.pointsLost);
    // Yet B ranks above A, because B won the head-to-head match.
    expect(byId.B.rank).toBeLessThan(byId.A.rank);
  });

  it("falls back to game difference for a 3-way tie", () => {
    // A, B, C each win exactly 1 and lose 1 (a 3-cycle: A>B, B>C, C>A),
    // so head-to-head can't cleanly separate all three — game difference
    // should decide it instead.
    const matches: StandingsMatchInput[] = [
      playedMatch("A", "B", "A", [[21, 5], [21, 5]]), // A: +2 games, big point diff
      playedMatch("B", "C", "B", [[21, 19], [19, 21], [21, 19]]), // close
      playedMatch("C", "A", "C", [[21, 20], [19, 21], [21, 20]]), // close
    ];
    const standings = computeRoundRobinStandings(["A", "B", "C"], matches);
    expect(standings.every((s) => s.wins === 1)).toBe(true);
    // A crushed B 2-0, and only narrowly lost to C 1-2, giving A the best
    // game differential of the three.
    expect(standings[0].entryId).toBe("A");
  });

  it("excludes unplayed matches from the tally", () => {
    const matches: StandingsMatchInput[] = [
      { entry1Id: "A", entry2Id: "B", winnerId: null, games: [] },
    ];
    const standings = computeRoundRobinStandings(["A", "B"], matches);
    expect(standings.find((s) => s.entryId === "A")!.played).toBe(0);
    expect(standings.find((s) => s.entryId === "B")!.played).toBe(0);
  });

  it("handles a walkover (winner recorded, no games) correctly", () => {
    const matches: StandingsMatchInput[] = [
      { entry1Id: "A", entry2Id: "B", winnerId: "A", games: [] },
    ];
    const standings = computeRoundRobinStandings(["A", "B"], matches);
    expect(standings.find((s) => s.entryId === "A")!.wins).toBe(1);
    expect(standings.find((s) => s.entryId === "B")!.losses).toBe(1);
  });
});
