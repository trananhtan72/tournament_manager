import { describe, it, expect } from "vitest";
import {
  generateKnockoutTies,
  generateRoundRobinTies,
  recomputeTieAdvancement,
  computeTieWinner,
  type TieAdvancementSlot,
} from "../ties";

describe("generateKnockoutTies", () => {
  it("seeds a team bracket the same way generateSingleEliminationBracket does, renamed to team1Id/team2Id", () => {
    const teams = [
      { entryId: "t1", seed: 1 },
      { entryId: "t2", seed: 2 },
      { entryId: "t3", seed: null },
      { entryId: "t4", seed: null },
    ];
    const ties = generateKnockoutTies(teams, () => 0, true);
    expect(ties.filter((t) => t.round === 1)).toHaveLength(2);
    expect(ties.filter((t) => t.round === 2)).toHaveLength(1);
    for (const tie of ties) {
      expect(tie).toHaveProperty("team1Id");
      expect(tie).toHaveProperty("team2Id");
      expect(tie).not.toHaveProperty("entry1Id");
    }
  });
});

describe("generateRoundRobinTies", () => {
  it("pairs every team with every other team once", () => {
    const ties = generateRoundRobinTies(["t1", "t2", "t3"]);
    expect(ties).toHaveLength(3);
    for (const tie of ties) {
      expect(tie).toHaveProperty("team1Id");
      expect(tie).toHaveProperty("team2Id");
    }
  });
});

describe("recomputeTieAdvancement", () => {
  it("cascades a knockout tie's winner into the next round's slot", () => {
    const ties: TieAdvancementSlot[] = [
      { round: 1, position: 0, team1Id: "t1", team2Id: "t2", winnerId: null },
      { round: 1, position: 1, team1Id: "t3", team2Id: "t4", winnerId: null },
      { round: 2, position: 0, team1Id: null, team2Id: null, winnerId: null },
    ];
    const result = recomputeTieAdvancement(ties, 1, 0, "t1");
    const final = result.find((t) => t.round === 2 && t.position === 0)!;
    expect(final.team1Id).toBe("t1");
    expect(final.team2Id).toBeNull();
  });

  it("clears a stale downstream winner when an earlier result changes", () => {
    const ties: TieAdvancementSlot[] = [
      { round: 1, position: 0, team1Id: "t1", team2Id: "t2", winnerId: "t1" },
      { round: 1, position: 1, team1Id: "t3", team2Id: "t4", winnerId: "t3" },
      { round: 2, position: 0, team1Id: "t1", team2Id: "t3", winnerId: "t1" },
    ];
    const result = recomputeTieAdvancement(ties, 1, 0, "t2");
    const final = result.find((t) => t.round === 2 && t.position === 0)!;
    expect(final.team1Id).toBe("t2");
    expect(final.winnerId).toBeNull();
  });
});

describe("computeTieWinner", () => {
  it("declares side 1 the winner once it reaches a majority of a 5-slot tie", () => {
    const rubbers = [{ winnerSide: 1 as const }, { winnerSide: 1 as const }, { winnerSide: 1 as const }];
    expect(computeTieWinner(5, rubbers)).toBe(1);
  });

  it("stays undecided before either side reaches the majority", () => {
    const rubbers = [{ winnerSide: 1 as const }, { winnerSide: 2 as const }, { winnerSide: null }];
    expect(computeTieWinner(5, rubbers)).toBeNull();
  });

  it("keeps declaring the clinching side even after every rubber is eventually played (no early-stop)", () => {
    const rubbers = [
      { winnerSide: 1 as const },
      { winnerSide: 1 as const },
      { winnerSide: 1 as const },
      { winnerSide: 2 as const },
      { winnerSide: 2 as const },
    ];
    expect(computeTieWinner(5, rubbers)).toBe(1);
  });

  it("stays undecided forever on an exact split in an even custom format", () => {
    const rubbers = [{ winnerSide: 1 as const }, { winnerSide: 1 as const }, { winnerSide: 2 as const }, { winnerSide: 2 as const }];
    expect(computeTieWinner(4, rubbers)).toBeNull();
  });
});
