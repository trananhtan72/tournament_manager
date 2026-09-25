import { describe, expect, it } from "vitest";
import { tournamentPhase } from "../tournamentPhase";

const start = new Date("2026-12-01T00:00:00.000Z");
const end = new Date("2026-12-03T00:00:00.000Z");

describe("tournamentPhase", () => {
  it("is upcoming before the first day", () => {
    expect(tournamentPhase(start, end, new Date("2026-11-30T23:59:59.000Z"))).toBe("upcoming");
  });

  it("is ongoing from the start of the first day", () => {
    expect(tournamentPhase(start, end, new Date("2026-12-01T00:00:00.000Z"))).toBe("ongoing");
    expect(tournamentPhase(start, end, new Date("2026-12-02T12:00:00.000Z"))).toBe("ongoing");
  });

  it("is still ongoing all day on the last day", () => {
    expect(tournamentPhase(start, end, new Date("2026-12-03T00:00:01.000Z"))).toBe("ongoing");
    expect(tournamentPhase(start, end, new Date("2026-12-03T23:59:59.000Z"))).toBe("ongoing");
  });

  it("is past once the last day is over", () => {
    expect(tournamentPhase(start, end, new Date("2026-12-04T00:00:00.000Z"))).toBe("past");
  });

  it("handles a one-day tournament", () => {
    expect(tournamentPhase(start, start, new Date("2026-12-01T18:00:00.000Z"))).toBe("ongoing");
    expect(tournamentPhase(start, start, new Date("2026-12-02T00:00:00.000Z"))).toBe("past");
  });
});
