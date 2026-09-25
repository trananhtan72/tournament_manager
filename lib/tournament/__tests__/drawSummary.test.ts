import { describe, expect, it } from "vitest";
import { drawSize, drawStage, type DrawSummaryMatch } from "../drawSummary";

const m = (
  round: number,
  entry1Id: string | null,
  entry2Id: string | null,
  winnerId: string | null = null,
  extra: Partial<DrawSummaryMatch> = {},
): DrawSummaryMatch => ({ poolId: null, round, isBye: false, winnerId, entry1Id, entry2Id, ...extra });

describe("drawSize", () => {
  it("counts the entries in round 1 of a knockout, including a bye's lone entry", () => {
    const bracket = [
      m(1, "a", "b"),
      m(1, "c", null, "c", { isBye: true }),
      m(2, null, null),
    ];
    expect(drawSize("SINGLE_ELIMINATION", bracket)).toBe(3);
  });

  it("ignores later rounds as entries advance", () => {
    expect(drawSize("SINGLE_ELIMINATION", [m(1, "a", "b", "a"), m(1, "c", "d", "c"), m(2, "a", "c")])).toBe(4);
  });

  it("counts each round-robin entry once", () => {
    expect(drawSize("ROUND_ROBIN", [m(1, "a", "b"), m(1, "a", "c"), m(1, "b", "c")])).toBe(3);
  });

  it("counts pool entries only, not the knockout that follows", () => {
    const pools = [
      m(0, "a", "b", null, { poolId: "A" }),
      m(0, "c", "d", null, { poolId: "B" }),
      m(1, "a", "c"),
    ];
    expect(drawSize("POOLS_KNOCKOUT", pools)).toBe(4);
  });

  it("is 0 with no matches", () => {
    expect(drawSize("SINGLE_ELIMINATION", [])).toBe(0);
  });
});

describe("drawStage — single elimination", () => {
  it("is 'Not drawn yet' with no matches", () => {
    expect(drawStage("SINGLE_ELIMINATION", [])).toBe("Not drawn yet");
  });

  it("names the first round before anything is played", () => {
    const bracket = [m(1, "a", "b"), m(1, "c", "d"), m(2, null, null)];
    expect(drawStage("SINGLE_ELIMINATION", bracket)).toBe("Semifinals");
  });

  it("moves to the next round once the earlier one is finished", () => {
    const bracket = [m(1, "a", "b", "a"), m(1, "c", "d", "c"), m(2, "a", "c")];
    expect(drawStage("SINGLE_ELIMINATION", bracket)).toBe("Final");
  });

  it("stays on a round while any match in it is unplayed", () => {
    const bracket = [m(1, "a", "b", "a"), m(1, "c", "d"), m(2, "a", null)];
    expect(drawStage("SINGLE_ELIMINATION", bracket)).toBe("Semifinals");
  });

  it("ignores byes when deciding whether a round is done", () => {
    const bracket = [
      m(1, "a", null, "a", { isBye: true }),
      m(1, "b", "c", "b"),
      m(2, "a", "b"),
    ];
    expect(drawStage("SINGLE_ELIMINATION", bracket)).toBe("Final");
  });

  it("is Completed once the final has a winner", () => {
    const bracket = [m(1, "a", "b", "a"), m(1, "c", "d", "c"), m(2, "a", "c", "a")];
    expect(drawStage("SINGLE_ELIMINATION", bracket)).toBe("Completed");
  });
});

describe("drawStage — round robin", () => {
  it("is 'Round robin' until every match is decided, then Completed", () => {
    expect(drawStage("ROUND_ROBIN", [m(1, "a", "b", "a"), m(1, "a", "c")])).toBe("Round robin");
    expect(drawStage("ROUND_ROBIN", [m(1, "a", "b", "a"), m(1, "a", "c", "c")])).toBe("Completed");
  });
});

describe("drawStage — pools + knockout", () => {
  const pool = (winner: string | null) => m(0, "a", "b", winner, { poolId: "A" });

  it("is 'Pool stage' while pool matches are unplayed", () => {
    expect(drawStage("POOLS_KNOCKOUT", [pool("a"), pool(null)])).toBe("Pool stage");
  });

  it("waits for the knockout once the pools are done", () => {
    expect(drawStage("POOLS_KNOCKOUT", [pool("a"), pool("b")])).toBe("Pool stage complete");
  });

  it("reports the knockout round, then Completed", () => {
    const pools = [pool("a"), pool("b")];
    const knockout = [m(1, "a", "c"), m(1, "b", "d"), m(2, null, null)];
    expect(drawStage("POOLS_KNOCKOUT", [...pools, ...knockout])).toBe("Knockout — Semifinals");
    const done = [m(1, "a", "c", "a"), m(1, "b", "d", "b"), m(2, "a", "b", "a")];
    expect(drawStage("POOLS_KNOCKOUT", [...pools, ...done])).toBe("Completed");
  });
});
