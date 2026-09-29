import { describe, expect, it } from "vitest";
import {
  cascadeReschedule,
  compareCourts,
  courtColumns,
  dateTimeLocalFromDevice,
  dayKey,
  distributeAcrossCourts,
  estimatedRangeMinutes,
  estimateMatchSchedule,
  formatElapsedDuration,
  formatEstimatedLabel,
  formatStartedLabel,
  formatDayHeading,
  formatScheduleLabel,
  formatTimeOfDay,
  groupByDay,
  isWithinTournamentDays,
  knockoutRoundCount,
  parseDateTimeLocal,
  sortSchedule,
  stageLabel,
  toDateTimeLocal,
  type ScheduleMatchInput,
} from "../schedule";

const at = (iso: string) => new Date(`${iso}:00.000Z`);
// Intl may use a narrow no-break space before AM/PM.
const plain = (s: string | null) => s?.replace(/\s/g, " ") ?? null;

describe("parseDateTimeLocal", () => {
  it("reads the wall-clock fields as UTC, so nothing shifts with the time zone", () => {
    const d = parseDateTimeLocal("2026-12-01T09:30");
    expect(d?.toISOString()).toBe("2026-12-01T09:30:00.000Z");
  });

  it("round-trips through toDateTimeLocal", () => {
    expect(toDateTimeLocal(parseDateTimeLocal("2026-12-03T18:05")!)).toBe("2026-12-03T18:05");
  });

  it("rejects malformed input", () => {
    for (const bad of ["", "2026-12-01", "2026-12-01 09:30", "12/01/2026 09:30", "2026-12-01T9:30", "abc"]) {
      expect(parseDateTimeLocal(bad)).toBeNull();
    }
  });

  it("rejects dates and times that don't exist instead of rolling them over", () => {
    expect(parseDateTimeLocal("2026-02-30T10:00")).toBeNull();
    expect(parseDateTimeLocal("2026-13-01T10:00")).toBeNull();
    expect(parseDateTimeLocal("2026-12-01T25:00")).toBeNull();
    expect(parseDateTimeLocal("2026-12-01T10:61")).toBeNull();
  });
});

describe("isWithinTournamentDays", () => {
  const start = new Date("2026-12-01T00:00:00.000Z");
  const end = new Date("2026-12-03T00:00:00.000Z");

  it("accepts any time on the first, middle and last day", () => {
    expect(isWithinTournamentDays(at("2026-12-01T00:00"), start, end)).toBe(true);
    expect(isWithinTournamentDays(at("2026-12-02T13:00"), start, end)).toBe(true);
    expect(isWithinTournamentDays(at("2026-12-03T23:59"), start, end)).toBe(true);
  });

  it("rejects the day before and the day after", () => {
    expect(isWithinTournamentDays(at("2026-11-30T23:59"), start, end)).toBe(false);
    expect(isWithinTournamentDays(at("2026-12-04T00:00"), start, end)).toBe(false);
  });

  it("works for a one-day tournament", () => {
    expect(isWithinTournamentDays(at("2026-12-01T08:00"), start, start)).toBe(true);
    expect(isWithinTournamentDays(at("2026-12-02T08:00"), start, start)).toBe(false);
  });
});

describe("formatting", () => {
  it("formats time, day heading and the combined label in UTC, prefixed 'est.' by default (not yet started)", () => {
    expect(plain(formatTimeOfDay(at("2026-12-01T09:30")))).toBe("9:30 AM");
    expect(plain(formatTimeOfDay(at("2026-12-01T18:05")))).toBe("6:05 PM");
    expect(formatDayHeading(at("2026-12-01T09:30"))).toBe("Tuesday, Dec 1");
    expect(plain(formatScheduleLabel({ scheduledAt: at("2026-12-01T09:30"), court: "Court 2" }))).toBe(
      "est. Tue, Dec 1 · 9:30 AM · Court 2",
    );
  });

  it("omits the court when there isn't one, and is null with no time", () => {
    expect(plain(formatScheduleLabel({ scheduledAt: at("2026-12-01T09:30"), court: null }))).toBe("est. Tue, Dec 1 · 9:30 AM");
    expect(formatScheduleLabel({ scheduledAt: null, court: "Court 1" })).toBeNull();
  });

  it("drops the 'est.' prefix once the match has a status (played or decided)", () => {
    expect(plain(formatScheduleLabel({ scheduledAt: at("2026-12-01T09:30"), court: null, status: "COMPLETED" }))).toBe(
      "Tue, Dec 1 · 9:30 AM",
    );
  });

  it("drops the 'est.' prefix once the match is live, even with no status yet", () => {
    expect(
      plain(
        formatScheduleLabel({
          scheduledAt: at("2026-12-01T09:30"),
          court: null,
          status: null,
          liveStartedAt: at("2026-12-01T09:32"),
        }),
      ),
    ).toBe("Tue, Dec 1 · 9:30 AM");
  });

  it("keeps the 'est.' prefix when status and liveStartedAt are explicitly null", () => {
    expect(
      plain(formatScheduleLabel({ scheduledAt: at("2026-12-01T09:30"), court: null, status: null, liveStartedAt: null })),
    ).toBe("est. Tue, Dec 1 · 9:30 AM");
  });
});

describe("compareCourts", () => {
  it("orders numbers naturally and puts no-court last", () => {
    const sorted = ["Court 10", null, "Court 2", "court 1"].sort(compareCourts);
    expect(sorted).toEqual(["court 1", "Court 2", "Court 10", null]);
  });
});

describe("sortSchedule / groupByDay", () => {
  const m = (id: string, when: string, court: string | null, eventName = "MS", round = 1, position = 0) => ({
    id,
    scheduledAt: at(when),
    court,
    eventName,
    round,
    position,
  });

  it("sorts by time, then court, then event/round/position", () => {
    const sorted = sortSchedule([
      m("late", "2026-12-01T11:00", "Court 1"),
      m("c2", "2026-12-01T09:00", "Court 2"),
      m("c1", "2026-12-01T09:00", "Court 1", "WS"),
      m("c1-ms", "2026-12-01T09:00", "Court 1", "MS"),
      m("nocourt", "2026-12-01T09:00", null),
      m("next-day", "2026-12-02T08:00", "Court 1"),
    ]);
    expect(sorted.map((x) => x.id)).toEqual(["c1-ms", "c1", "c2", "nocourt", "late", "next-day"]);
  });

  it("does not mutate its input", () => {
    const input = [m("b", "2026-12-01T10:00", null), m("a", "2026-12-01T09:00", null)];
    sortSchedule(input);
    expect(input.map((x) => x.id)).toEqual(["b", "a"]);
  });

  it("groups sorted items into consecutive calendar days", () => {
    const days = groupByDay(
      sortSchedule([
        m("d2", "2026-12-02T08:00", null),
        m("d1a", "2026-12-01T09:00", null),
        m("d1b", "2026-12-01T23:30", null),
        m("d3", "2026-12-03T08:00", null),
      ]),
    );
    expect(days.map((d) => [d.day, d.items.map((i) => i.id)])).toEqual([
      ["2026-12-01", ["d1a", "d1b"]],
      ["2026-12-02", ["d2"]],
      ["2026-12-03", ["d3"]],
    ]);
    expect(dayKey(days[0].date)).toBe("2026-12-01");
  });

  it("returns no days for no matches", () => {
    expect(groupByDay([])).toEqual([]);
  });
});

describe("courtColumns", () => {
  const m = (id: string, court: string | null) => ({ id, court });

  it("groups by court, numbered courts in order, preserving each column's item order", () => {
    const columns = courtColumns([
      m("a", "Court 2"),
      m("b", "Court 1"),
      m("c", "Court 2"),
      m("d", "Court 10"),
      m("e", "Court 1"),
    ]);
    expect(columns.map((c) => [c.court, c.items.map((i) => i.id)])).toEqual([
      ["Court 1", ["b", "e"]],
      ["Court 2", ["a", "c"]],
      ["Court 10", ["d"]],
    ]);
  });

  it("sorts a non-numbered court name after numbered courts", () => {
    const columns = courtColumns([m("a", "Show Court"), m("b", "Court 1")]);
    expect(columns.map((c) => c.court)).toEqual(["Court 1", "Show Court"]);
  });

  it("puts items with no court in a trailing 'No court' column", () => {
    const columns = courtColumns([m("a", null), m("b", "Court 1"), m("c", null)]);
    expect(columns.map((c) => [c.court, c.items.map((i) => i.id)])).toEqual([
      ["Court 1", ["b"]],
      ["No court", ["a", "c"]],
    ]);
  });

  it("returns no columns for no items", () => {
    expect(courtColumns([])).toEqual([]);
  });
});

describe("stageLabel", () => {
  it("uses the pool name for pool matches", () => {
    expect(stageLabel({ poolName: "Pool B", round: 0 }, { drawFormat: "POOLS_KNOCKOUT", knockoutRounds: 0 })).toBe("Pool B");
  });

  it("calls every round-robin match 'Round robin' (not 'Final')", () => {
    expect(stageLabel({ poolName: null, round: 1 }, { drawFormat: "ROUND_ROBIN", knockoutRounds: 1 })).toBe("Round robin");
  });

  it("names knockout rounds from the end", () => {
    const event = { drawFormat: "SINGLE_ELIMINATION" as const, knockoutRounds: 3 };
    expect(stageLabel({ poolName: null, round: 1 }, event)).toBe("Quarterfinals");
    expect(stageLabel({ poolName: null, round: 2 }, event)).toBe("Semifinals");
    expect(stageLabel({ poolName: null, round: 3 }, event)).toBe("Final");
  });
});

describe("knockoutRoundCount", () => {
  it("ignores pool matches", () => {
    expect(
      knockoutRoundCount([
        { poolId: "p1", round: 0 },
        { poolId: null, round: 1 },
        { poolId: null, round: 2 },
      ]),
    ).toBe(2);
    expect(knockoutRoundCount([{ poolId: "p1", round: 0 }])).toBe(0);
    expect(knockoutRoundCount([])).toBe(0);
  });
});

describe("dateTimeLocalFromDevice", () => {
  it("reads the device's own local wall-clock time, in datetime-local format", () => {
    // Built from local components, so this holds in any time zone.
    expect(dateTimeLocalFromDevice(new Date(2026, 11, 1, 9, 5))).toBe("2026-12-01T09:05");
    expect(dateTimeLocalFromDevice(new Date(2026, 0, 31, 23, 59))).toBe("2026-01-31T23:59");
    expect(dateTimeLocalFromDevice(new Date(2026, 5, 7, 0, 0))).toBe("2026-06-07T00:00");
  });

  it("round-trips through parseDateTimeLocal to the same floating time", () => {
    const value = dateTimeLocalFromDevice(new Date(2026, 11, 1, 14, 30));
    expect(parseDateTimeLocal(value)?.toISOString()).toBe("2026-12-01T14:30:00.000Z");
  });
});

describe("formatStartedLabel", () => {
  it("says when the match started, in floating time", () => {
    expect(plain(formatStartedLabel(at("2026-12-01T09:07")))).toBe("Started Tue, Dec 1 · 9:07 AM");
  });

  it("is null without a start time", () => {
    expect(formatStartedLabel(null)).toBeNull();
  });
});

describe("formatElapsedDuration", () => {
  it("formats minutes and seconds under an hour", () => {
    expect(formatElapsedDuration(0)).toBe("0:00");
    expect(formatElapsedDuration(65_000)).toBe("1:05");
    expect(formatElapsedDuration(9 * 60_000 + 5_000)).toBe("9:05");
    expect(formatElapsedDuration(59 * 60_000 + 59_000)).toBe("59:59");
  });

  it("adds an hours component once it reaches an hour", () => {
    expect(formatElapsedDuration(60 * 60_000)).toBe("1:00:00");
    expect(formatElapsedDuration(62 * 60_000 + 5_000)).toBe("1:02:05");
  });

  it("truncates rather than rounds partial seconds", () => {
    expect(formatElapsedDuration(65_999)).toBe("1:05");
  });

  it("floors a negative or zero duration to 0:00, rather than showing nonsense", () => {
    expect(formatElapsedDuration(-5000)).toBe("0:00");
  });
});

describe("estimateMatchSchedule", () => {
  const dayStart = at("2026-12-01T09:00");

  function match(overrides: Partial<ScheduleMatchInput> & { matchId: string }): ScheduleMatchInput {
    return {
      eventId: "e1",
      drawFormat: "SINGLE_ELIMINATION",
      round: 1,
      position: 0,
      feederMatchIds: null,
      isBye: false,
      status: null,
      entry1PlayerKeys: ["p1"],
      entry2PlayerKeys: ["p2"],
      actualStart: null,
      actualEnd: null,
      ...overrides,
    };
  }

  it("schedules independent matches back to back on a single court", () => {
    const matches = [
      match({ matchId: "m1", position: 0, entry1PlayerKeys: ["a"], entry2PlayerKeys: ["b"] }),
      match({ matchId: "m2", position: 1, entry1PlayerKeys: ["c"], entry2PlayerKeys: ["d"] }),
    ];
    const estimates = estimateMatchSchedule(matches, { courts: 1, dayStart }, dayStart);
    const byId = new Map(estimates.map((e) => [e.matchId, e]));
    expect(byId.get("m1")!.estimatedStart).toEqual(dayStart);
    // 45 min match + 5 min changeover (defaults) after m1 starts.
    expect(byId.get("m2")!.estimatedStart).toEqual(at("2026-12-01T09:50"));
  });

  it("runs independent matches in parallel across separate courts", () => {
    const matches = [
      match({ matchId: "m1", position: 0, entry1PlayerKeys: ["a"], entry2PlayerKeys: ["b"] }),
      match({ matchId: "m2", position: 1, entry1PlayerKeys: ["c"], entry2PlayerKeys: ["d"] }),
    ];
    const estimates = estimateMatchSchedule(matches, { courts: 2, dayStart }, dayStart);
    expect(estimates.every((e) => e.estimatedStart.getTime() === dayStart.getTime())).toBe(true);
  });

  it("never starts a player's next match before their rest period ends, even with a free court", () => {
    const matches = [
      match({ matchId: "m1", position: 0, entry1PlayerKeys: ["a"], entry2PlayerKeys: ["b"] }),
      // Same player "a" again, against someone else — plenty of courts, but
      // "a" still needs to rest after m1.
      match({ matchId: "m2", position: 1, entry1PlayerKeys: ["a"], entry2PlayerKeys: ["c"] }),
    ];
    const estimates = estimateMatchSchedule(matches, { courts: 4, dayStart }, dayStart);
    const byId = new Map(estimates.map((e) => [e.matchId, e]));
    // m1: 09:00-09:45. Rest 25 min -> earliest "a" can start again is 10:10.
    expect(byId.get("m1")!.estimatedStart).toEqual(at("2026-12-01T09:00"));
    expect(byId.get("m2")!.estimatedStart).toEqual(at("2026-12-01T10:10"));
  });

  it("a round-2 match waits for both feeders, using court time alone when its entries aren't decided yet", () => {
    const matches = [
      match({ matchId: "qf1", round: 1, position: 0, entry1PlayerKeys: ["a"], entry2PlayerKeys: ["b"] }),
      match({ matchId: "qf2", round: 1, position: 1, entry1PlayerKeys: ["c"], entry2PlayerKeys: ["d"] }),
      match({
        matchId: "sf",
        round: 2,
        position: 0,
        feederMatchIds: ["qf1", "qf2"],
        entry1PlayerKeys: null,
        entry2PlayerKeys: null,
      }),
    ];
    // 2 courts: both quarterfinals run in parallel, finishing at 09:45, but
    // both courts also need their 5-minute changeover before reuse — with no
    // spare court left, "sf" waits for that too.
    const estimates = estimateMatchSchedule(matches, { courts: 2, dayStart }, dayStart);
    const byId = new Map(estimates.map((e) => [e.matchId, e]));
    expect(byId.get("qf1")!.estimatedStart).toEqual(dayStart);
    expect(byId.get("qf2")!.estimatedStart).toEqual(dayStart);
    expect(byId.get("sf")!.estimatedStart).toEqual(at("2026-12-01T09:50"));
  });

  it("a bye feeder costs no time at all", () => {
    const matches = [
      match({ matchId: "qf1", round: 1, position: 0, isBye: true, entry1PlayerKeys: ["a"], entry2PlayerKeys: null }),
      match({ matchId: "qf2", round: 1, position: 1, entry1PlayerKeys: ["c"], entry2PlayerKeys: ["d"] }),
      match({
        matchId: "sf",
        round: 2,
        position: 0,
        feederMatchIds: ["qf1", "qf2"],
        entry1PlayerKeys: null,
        entry2PlayerKeys: null,
      }),
    ];
    const estimates = estimateMatchSchedule(matches, { courts: 2, dayStart }, dayStart);
    const byId = new Map(estimates.map((e) => [e.matchId, e]));
    // A bye never gets its own estimate.
    expect(byId.has("qf1")).toBe(false);
    // sf only waits on qf2 (the real match) — qf1's bye contributes nothing.
    expect(byId.get("sf")!.estimatedStart).toEqual(at("2026-12-01T09:45"));
  });

  it("excludes matches that are already played, live, or a bye from the output", () => {
    const matches = [
      match({ matchId: "played", status: "COMPLETED", actualStart: dayStart, actualEnd: at("2026-12-01T09:40") }),
      match({ matchId: "live", actualStart: dayStart }),
      match({ matchId: "bye", isBye: true }),
      match({ matchId: "pending", position: 3 }),
    ];
    const estimates = estimateMatchSchedule(matches, { courts: 4, dayStart }, dayStart);
    expect(estimates.map((e) => e.matchId)).toEqual(["pending"]);
  });

  it("a live match ties up one court until its estimated finish", () => {
    const matches = [
      match({ matchId: "live", position: 0, actualStart: dayStart, entry1PlayerKeys: ["a"], entry2PlayerKeys: ["b"] }),
      match({ matchId: "next", position: 1, entry1PlayerKeys: ["c"], entry2PlayerKeys: ["d"] }),
    ];
    // Only 1 court, already occupied by "live" until 09:45.
    const estimates = estimateMatchSchedule(matches, { courts: 1, dayStart }, dayStart);
    expect(estimates[0].matchId).toBe("next");
    expect(estimates[0].estimatedStart).toEqual(at("2026-12-01T09:45"));
  });

  it("prioritizes the event with more rounds remaining when courts are scarce", () => {
    const matches = [
      // Event A: a semifinal — 2 rounds still ahead of it (semi + final).
      match({
        matchId: "semiA",
        eventId: "A",
        drawFormat: "SINGLE_ELIMINATION",
        round: 2,
        position: 0,
        entry1PlayerKeys: ["a1"],
        entry2PlayerKeys: ["a2"],
      }),
      match({ matchId: "finalA", eventId: "A", drawFormat: "SINGLE_ELIMINATION", round: 3, position: 0, feederMatchIds: ["semiA", "semiA"], entry1PlayerKeys: null, entry2PlayerKeys: null }),
      // Event B: a round-robin match — flat, low priority.
      match({ matchId: "rrB", eventId: "B", drawFormat: "ROUND_ROBIN", round: 1, position: 0, entry1PlayerKeys: ["b1"], entry2PlayerKeys: ["b2"] }),
    ];
    // Only one court: semiA and rrB are both immediately ready: semiA must win it.
    const estimates = estimateMatchSchedule(matches, { courts: 1, dayStart }, dayStart);
    const byId = new Map(estimates.map((e) => [e.matchId, e]));
    expect(byId.get("semiA")!.estimatedStart).toEqual(dayStart);
    expect(byId.get("rrB")!.estimatedStart.getTime()).toBeGreaterThan(dayStart.getTime());
  });

  it("numbers queueDepth by position in the overall start order", () => {
    const matches = [
      match({ matchId: "m1", position: 0, entry1PlayerKeys: ["a"], entry2PlayerKeys: ["b"] }),
      match({ matchId: "m2", position: 1, entry1PlayerKeys: ["c"], entry2PlayerKeys: ["d"] }),
      match({ matchId: "m3", position: 2, entry1PlayerKeys: ["e"], entry2PlayerKeys: ["f"] }),
    ];
    const estimates = estimateMatchSchedule(matches, { courts: 1, dayStart }, dayStart);
    const byId = new Map(estimates.map((e) => [e.matchId, e]));
    expect(byId.get("m1")!.queueDepth).toBe(0);
    expect(byId.get("m2")!.queueDepth).toBe(1);
    expect(byId.get("m3")!.queueDepth).toBe(2);
  });

  it("respects custom duration, changeover and rest instead of the defaults", () => {
    const matches = [
      match({ matchId: "m1", position: 0, entry1PlayerKeys: ["a"], entry2PlayerKeys: ["b"] }),
      match({ matchId: "m2", position: 1, entry1PlayerKeys: ["a"], entry2PlayerKeys: ["c"] }),
    ];
    const estimates = estimateMatchSchedule(
      matches,
      { courts: 4, dayStart, matchDurationMinutes: 30, changeoverMinutes: 10, minRestMinutes: 60 },
      dayStart,
    );
    const byId = new Map(estimates.map((e) => [e.matchId, e]));
    // m1: 09:00-09:30. "a" rests 60 min -> earliest again at 10:30 (rest
    // dominates the 30 min match + 10 min changeover a free court would allow).
    expect(byId.get("m1")!.estimatedStart).toEqual(at("2026-12-01T09:00"));
    expect(byId.get("m2")!.estimatedStart).toEqual(at("2026-12-01T10:30"));
  });

  it("never estimates a start before dayStart/now, even with everything else free", () => {
    const matches = [match({ matchId: "m1" })];
    const now = at("2026-12-01T09:20");
    const estimates = estimateMatchSchedule(matches, { courts: 4, dayStart }, now);
    expect(estimates[0].estimatedStart).toEqual(now);
  });

  it("treats an empty player-key list (e.g. an unlinked guest) as no rest constraint", () => {
    const matches = [
      match({ matchId: "m1", position: 0, entry1PlayerKeys: [], entry2PlayerKeys: [] }),
      match({ matchId: "m2", position: 1, entry1PlayerKeys: [], entry2PlayerKeys: [] }),
    ];
    const estimates = estimateMatchSchedule(matches, { courts: 1, dayStart }, dayStart);
    // No shared identity between m1 and m2, so this is just plain court queuing.
    const byId = new Map(estimates.map((e) => [e.matchId, e]));
    expect(byId.get("m2")!.estimatedStart).toEqual(at("2026-12-01T09:50"));
  });

  it("is deterministic for the same input", () => {
    const matches = [
      match({ matchId: "m1", position: 0, entry1PlayerKeys: ["a"], entry2PlayerKeys: ["b"] }),
      match({ matchId: "m2", position: 1, entry1PlayerKeys: ["c"], entry2PlayerKeys: ["d"] }),
      match({ matchId: "m3", position: 2, entry1PlayerKeys: ["e"], entry2PlayerKeys: ["f"] }),
    ];
    const run1 = estimateMatchSchedule(matches, { courts: 2, dayStart }, dayStart);
    const run2 = estimateMatchSchedule(matches, { courts: 2, dayStart }, dayStart);
    expect(run1).toEqual(run2);
  });
});

describe("estimatedRangeMinutes / formatEstimatedLabel", () => {
  it("widens with queue depth, capped at an hour", () => {
    expect(estimatedRangeMinutes(0)).toBe(10);
    expect(estimatedRangeMinutes(2)).toBe(20);
    expect(estimatedRangeMinutes(100)).toBe(60);
  });

  it("formats a time with its uncertainty window", () => {
    expect(plain(formatEstimatedLabel(at("2026-12-01T14:15"), 2))).toBe("~2:15 PM (± 20 min)");
  });
});

describe("distributeAcrossCourts", () => {
  const base = { start: at("2026-12-01T09:00"), matchDurationMinutes: 40, minRestMinutes: 10 };
  const byId = (result: { matchId: string; start: Date; court: number }[], id: string) =>
    result.find((r) => r.matchId === id);

  it("spreads matches with no shared players across all available courts in parallel, lowest court number first", () => {
    const matches = ["a", "b", "c"].map((id) => ({ matchId: id, playerKeys: [] }));
    const result = distributeAcrossCourts(matches, { ...base, courts: 3 });
    // No player conflicts, so all three start at once, one per court, 1 through 3 in order.
    expect(byId(result, "a")).toEqual({ matchId: "a", start: at("2026-12-01T09:00"), court: 1 });
    expect(byId(result, "b")).toEqual({ matchId: "b", start: at("2026-12-01T09:00"), court: 2 });
    expect(byId(result, "c")).toEqual({ matchId: "c", start: at("2026-12-01T09:00"), court: 3 });
  });

  it("queues onto the same court back to back when there's only one court", () => {
    const matches = ["a", "b", "c"].map((id) => ({ matchId: id, playerKeys: [] }));
    const result = distributeAcrossCourts(matches, { ...base, courts: 1 });
    expect(byId(result, "a")).toMatchObject({ start: at("2026-12-01T09:00"), court: 1 });
    expect(byId(result, "b")).toMatchObject({ start: at("2026-12-01T09:40"), court: 1 });
    expect(byId(result, "c")).toMatchObject({ start: at("2026-12-01T10:20"), court: 1 });
  });

  it("returns an empty array for no matches", () => {
    expect(distributeAcrossCourts([], { ...base, courts: 2 })).toEqual([]);
  });

  it("holds a player's next match until they've rested, even on a free court", () => {
    // Same player in both singles (a) and doubles (b) — plenty of courts, but
    // b can't start until 10 minutes after a's 40-minute match ends.
    const matches = [
      { matchId: "a", playerKeys: ["alice"] },
      { matchId: "b", playerKeys: ["alice", "carol"] },
    ];
    const result = distributeAcrossCourts(matches, { ...base, courts: 4 });
    expect(byId(result, "a")?.start).toEqual(at("2026-12-01T09:00"));
    expect(byId(result, "b")?.start).toEqual(at("2026-12-01T09:50")); // 09:40 finish + 10 min rest
  });

  it("doesn't hold up a match whose players don't overlap with an earlier one", () => {
    const matches = [
      { matchId: "a", playerKeys: ["alice"] },
      { matchId: "b", playerKeys: ["bob"] },
    ];
    const result = distributeAcrossCourts(matches, { ...base, courts: 1 });
    // Different players, but only one court, so b still queues for the court —
    // just not for rest.
    expect(byId(result, "b")?.start).toEqual(at("2026-12-01T09:40"));
  });

  it("respects priorBusyUntil for a player's match outside this batch", () => {
    const matches = [{ matchId: "b", playerKeys: ["alice"] }];
    const result = distributeAcrossCourts(matches, {
      ...base,
      courts: 2,
      priorBusyUntil: new Map([["alice", at("2026-12-01T09:35")]]),
    });
    expect(byId(result, "b")?.start).toEqual(at("2026-12-01T09:35"));
  });

  it("treats an empty playerKeys list (guests, or a still-TBD side) as no rest constraint", () => {
    const matches = [
      { matchId: "a", playerKeys: [] },
      { matchId: "b", playerKeys: [] },
    ];
    const result = distributeAcrossCourts(matches, { ...base, courts: 1 });
    expect(byId(result, "b")?.start).toEqual(at("2026-12-01T09:40"));
  });

  it("supports zero rest (back to back for the same player with no gap)", () => {
    const matches = [
      { matchId: "a", playerKeys: ["alice"] },
      { matchId: "b", playerKeys: ["alice"] },
    ];
    const result = distributeAcrossCourts(matches, { ...base, courts: 4, minRestMinutes: 0 });
    expect(byId(result, "b")?.start).toEqual(at("2026-12-01T09:40"));
  });

  it("processes matches in the given order, not reordering by any priority", () => {
    const matches = [
      { matchId: "low-priority-but-first", playerKeys: [] },
      { matchId: "high-priority-but-second", playerKeys: [] },
    ];
    const result = distributeAcrossCourts(matches, { ...base, courts: 1 });
    expect(byId(result, "low-priority-but-first")?.start).toEqual(at("2026-12-01T09:00"));
    expect(byId(result, "high-priority-but-second")?.start).toEqual(at("2026-12-01T09:40"));
  });

  it("schedules around a prior booking on court 1, filling court 2 instead", () => {
    const matches = [{ matchId: "a", playerKeys: [] }];
    const result = distributeAcrossCourts(matches, {
      ...base,
      courts: 2,
      priorCourtBusy: [{ court: 1, start: at("2026-12-01T09:00"), end: at("2026-12-01T09:40") }],
    });
    expect(byId(result, "a")).toEqual({ matchId: "a", start: at("2026-12-01T09:00"), court: 2 });
  });

  it("delays onto a busy court until its prior booking ends, rather than double-booking it", () => {
    const matches = [{ matchId: "a", playerKeys: [] }];
    const result = distributeAcrossCourts(matches, {
      ...base,
      courts: 1,
      priorCourtBusy: [{ court: 1, start: at("2026-12-01T09:00"), end: at("2026-12-01T09:30") }],
    });
    expect(byId(result, "a")).toEqual({ matchId: "a", start: at("2026-12-01T09:30"), court: 1 });
  });

  it("fits a match into a gap between two prior bookings on the same court", () => {
    const matches = [{ matchId: "a", playerKeys: [] }];
    const result = distributeAcrossCourts(matches, {
      ...base,
      courts: 1,
      matchDurationMinutes: 20,
      priorCourtBusy: [
        { court: 1, start: at("2026-12-01T09:00"), end: at("2026-12-01T09:20") },
        { court: 1, start: at("2026-12-01T09:40"), end: at("2026-12-01T10:00") },
      ],
    });
    expect(byId(result, "a")).toEqual({ matchId: "a", start: at("2026-12-01T09:20"), court: 1 });
  });

  it("ignores a prior booking on a court number outside the range being scheduled", () => {
    const matches = [{ matchId: "a", playerKeys: [] }];
    const result = distributeAcrossCourts(matches, {
      ...base,
      courts: 1,
      priorCourtBusy: [{ court: 5, start: at("2026-12-01T09:00"), end: at("2026-12-01T09:40") }],
    });
    expect(byId(result, "a")).toEqual({ matchId: "a", start: at("2026-12-01T09:00"), court: 1 });
  });

  it("doesn't start a final before both of its feeders (scheduled earlier in this same batch) have finished, even with an empty court sitting idle", () => {
    const matches = [
      { matchId: "semiA", playerKeys: [] },
      { matchId: "semiB", playerKeys: [] },
      { matchId: "final", playerKeys: [], feederMatchIds: ["semiA", "semiB"] as const },
    ];
    // 3 courts: semiA and semiB both start at 09:00 on their own courts, so a
    // naive "earliest empty court" pick would put the final on the third
    // court at 09:00 too — before either semifinal is even decided.
    const result = distributeAcrossCourts(matches, { ...base, courts: 3 });
    expect(byId(result, "semiA")).toMatchObject({ start: at("2026-12-01T09:00") });
    expect(byId(result, "semiB")).toMatchObject({ start: at("2026-12-01T09:00") });
    expect(byId(result, "final")?.start).toEqual(at("2026-12-01T09:40"));
  });

  it("uses priorFinishTimes for a feeder that isn't part of this batch (already played or scheduled elsewhere)", () => {
    const matches = [{ matchId: "final", playerKeys: [], feederMatchIds: ["semiA", "semiB"] as const }];
    const result = distributeAcrossCourts(matches, {
      ...base,
      courts: 2,
      priorFinishTimes: new Map([
        ["semiA", at("2026-12-01T09:20")],
        ["semiB", at("2026-12-01T09:35")],
      ]),
    });
    // Ready only once the LATER of the two feeders is done.
    expect(byId(result, "final")?.start).toEqual(at("2026-12-01T09:35"));
  });

  it("combines an in-batch feeder with a priorFinishTimes feeder, taking whichever finishes later", () => {
    const matches = [
      { matchId: "semiA", playerKeys: [] },
      { matchId: "final", playerKeys: [], feederMatchIds: ["semiA", "semiB"] as const },
    ];
    const result = distributeAcrossCourts(matches, {
      ...base,
      courts: 2,
      priorFinishTimes: new Map([["semiB", at("2026-12-01T09:55")]]), // finishes later than semiA's 09:40
    });
    expect(byId(result, "final")?.start).toEqual(at("2026-12-01T09:55"));
  });

  it("treats a feeder missing from both the batch and priorFinishTimes as no constraint, rather than blocking the match", () => {
    const matches = [{ matchId: "final", playerKeys: [], feederMatchIds: ["unknownA", "unknownB"] as const }];
    const result = distributeAcrossCourts(matches, { ...base, courts: 1 });
    expect(byId(result, "final")?.start).toEqual(at("2026-12-01T09:00"));
  });

  it("still respects the feeder floor even when a player-rest floor would allow an earlier start", () => {
    // The final's own players aren't known yet (empty keys), so nothing rest-related
    // holds it back — only the feeder floor should.
    const matches = [
      { matchId: "semiA", playerKeys: [] },
      { matchId: "final", playerKeys: [], feederMatchIds: ["semiA", "semiB"] as const },
    ];
    const result = distributeAcrossCourts(matches, {
      ...base,
      courts: 2,
      priorFinishTimes: new Map([["semiB", at("2026-12-01T09:15")]]),
    });
    // semiA finishes at 09:40 (later than semiB's 09:15), so that's the floor.
    expect(byId(result, "final")?.start).toEqual(at("2026-12-01T09:40"));
  });
});

describe("cascadeReschedule", () => {
  const REST = 10;
  const concludedOn = (court: string | null, scheduledAtIso: string, playerKeys: readonly string[] = []) => ({
    matchId: "concluded",
    court,
    scheduledAt: at(scheduledAtIso),
    playerKeys,
  });
  const m = (
    matchId: string,
    court: string | null,
    scheduledAtIso: string,
    playerKeys: readonly string[] = [],
    feederMatchIds: readonly [string, string] | null = null,
  ) => ({
    matchId,
    court,
    scheduledAt: at(scheduledAtIso),
    playerKeys,
    feederMatchIds,
  });

  it("shifts everything queued behind it on the same court earlier when it finishes early", () => {
    // Scheduled 09:00-09:40, but actually finishes at 09:30 (10 min early).
    const concluded = concludedOn("Court 1", "2026-12-01T09:00");
    const others = [
      m("next", "Court 1", "2026-12-01T09:40"),
      m("after", "Court 1", "2026-12-01T10:20"),
      m("otherCourt", "Court 2", "2026-12-01T09:40"), // unaffected — different court, no shared player
    ];
    const result = cascadeReschedule(others, concluded, at("2026-12-01T09:30"), REST);
    expect(result.get("next")).toEqual(at("2026-12-01T09:30"));
    expect(result.get("after")).toEqual(at("2026-12-01T10:10")); // same 40-min gap preserved
    expect(result.has("otherCourt")).toBe(false);
  });

  it("shifts everything queued behind it on the same court later when it runs long", () => {
    // Scheduled to free the court by 09:40, but actually finishes at 10:00 (20 min late).
    const concluded = concludedOn("Court 1", "2026-12-01T09:00");
    const others = [m("next", "Court 1", "2026-12-01T09:40"), m("after", "Court 1", "2026-12-01T10:20")];
    const result = cascadeReschedule(others, concluded, at("2026-12-01T10:00"), REST);
    expect(result.get("next")).toEqual(at("2026-12-01T10:00"));
    expect(result.get("after")).toEqual(at("2026-12-01T10:40"));
  });

  it("does nothing when the match finishes exactly on schedule", () => {
    const concluded = concludedOn("Court 1", "2026-12-01T09:00");
    const others = [m("next", "Court 1", "2026-12-01T09:40")];
    const result = cascadeReschedule(others, concluded, at("2026-12-01T09:40"), REST);
    expect(result.size).toBe(0);
  });

  it("does nothing on that court when nothing is queued behind it", () => {
    const concluded = concludedOn("Court 1", "2026-12-01T09:00");
    const others = [m("earlier", "Court 1", "2026-12-01T08:00")]; // before the concluded match, not behind it
    const result = cascadeReschedule(others, concluded, at("2026-12-01T09:50"), REST);
    expect(result.size).toBe(0);
  });

  it("pushes a shared player's match on a different court later if it would start before they've rested", () => {
    // Alice's doubles match was to end 09:40, but runs until 10:00 — her singles match at 09:50 no longer has 10 min of rest.
    const concluded = concludedOn("Court 1", "2026-12-01T09:00", ["alice"]);
    const others = [m("alicesSingles", "Court 2", "2026-12-01T09:50", ["alice"])];
    const result = cascadeReschedule(others, concluded, at("2026-12-01T10:00"), REST);
    expect(result.get("alicesSingles")).toEqual(at("2026-12-01T10:10")); // 10:00 finish + 10 min rest
  });

  it("never pulls a shared player's other match earlier, even if the concluded match finished early", () => {
    const concluded = concludedOn("Court 1", "2026-12-01T09:00", ["alice"]);
    const others = [m("alicesSingles", "Court 2", "2026-12-01T09:50", ["alice"])];
    const result = cascadeReschedule(others, concluded, at("2026-12-01T09:20"), REST);
    expect(result.size).toBe(0);
  });

  it("doesn't push a rested player's match even if it's soon after", () => {
    const concluded = concludedOn("Court 1", "2026-12-01T09:00", ["alice"]);
    const others = [m("alicesSingles", "Court 2", "2026-12-01T10:15", ["alice"])];
    const result = cascadeReschedule(others, concluded, at("2026-12-01T10:00"), REST); // finishes 10:00, rests until 10:10 — 10:15 is fine
    expect(result.size).toBe(0);
  });

  it("cascades a cross-court rest push to whatever's queued behind it on its own court", () => {
    const concluded = concludedOn("Court 1", "2026-12-01T09:00", ["alice"]);
    const others = [
      m("alicesSingles", "Court 2", "2026-12-01T09:50", ["alice"]),
      m("nextOnCourt2", "Court 2", "2026-12-01T10:30"),
    ];
    const result = cascadeReschedule(others, concluded, at("2026-12-01T10:00"), REST);
    expect(result.get("alicesSingles")).toEqual(at("2026-12-01T10:10"));
    expect(result.get("nextOnCourt2")).toEqual(at("2026-12-01T10:50")); // same 40-min gap preserved
  });

  it("ignores matches scheduled on a different day", () => {
    const concluded = concludedOn("Court 1", "2026-12-01T09:00", ["alice"]);
    const others = [
      m("nextDayCourt1", "Court 1", "2026-12-02T09:40"),
      m("nextDaySingles", "Court 2", "2026-12-02T09:10", ["alice"]),
    ];
    const result = cascadeReschedule(others, concluded, at("2026-12-01T10:00"), REST);
    expect(result.size).toBe(0);
  });

  it("still applies the cross-court rest push when the concluded match had no court", () => {
    const concluded = concludedOn(null, "2026-12-01T09:00", ["alice"]);
    const others = [m("alicesSingles", "Court 2", "2026-12-01T09:50", ["alice"])];
    const result = cascadeReschedule(others, concluded, at("2026-12-01T10:00"), REST);
    expect(result.get("alicesSingles")).toEqual(at("2026-12-01T10:10"));
  });

  it("returns nothing when the concluded match has no players and nothing queued behind it", () => {
    const concluded = concludedOn("Court 1", "2026-12-01T09:00");
    const result = cascadeReschedule([], concluded, at("2026-12-01T09:35"), REST);
    expect(result.size).toBe(0);
  });

  it("doesn't let an early finish drag a final (queued behind it on the same court) ahead of a semifinal still running on a different court", () => {
    // semiA (the concluded match) and semiB both started at 09:00 on courts 1
    // and 2; the final is queued right behind semiA on court 1 at 09:40. If
    // semiA finishes at 09:15, the naive same-court rule would pull the final
    // to 09:15 — before semiB (still running, assumed to finish at 09:40) is
    // even decided.
    const concluded = concludedOn("Court 1", "2026-12-01T09:00");
    const semiB = m("semiB", "Court 2", "2026-12-01T09:00");
    const final = m("final", "Court 1", "2026-12-01T09:40", [], ["concluded", "semiB"]);
    const result = cascadeReschedule([semiB, final], concluded, at("2026-12-01T09:15"), REST, 40);
    expect(result.has("semiB")).toBe(false); // semiB itself isn't touched
    expect(result.get("final")).toEqual(at("2026-12-01T09:40")); // held at semiB's assumed finish, not pulled to 09:15
  });

  it("lets the final move earlier once both feeders are accounted for", () => {
    // Same setup, but semiB is already scheduled to finish earlier (08:50) —
    // once semiA finishes at 09:15, that's now the later of the two feeders.
    const concluded = concludedOn("Court 1", "2026-12-01T08:10");
    const semiB = m("semiB", "Court 2", "2026-12-01T08:10");
    const final = m("final", "Court 1", "2026-12-01T08:50", [], ["concluded", "semiB"]);
    const result = cascadeReschedule([semiB, final], concluded, at("2026-12-01T08:50"), REST, 40);
    // semiB assumed finish: 08:10 + 40min = 08:50. semiA's real finish: 08:50. Floor = 08:50 (unchanged).
    expect(result.has("final")).toBe(false);
  });

  it("floors a final on the concluded match's real finish, not its originally-assumed one", () => {
    const concluded = concludedOn("Court 3", "2026-12-01T09:00"); // not on the same court as the final — isolates the feeder rule
    const semiB = m("semiB", "Court 2", "2026-12-01T09:00");
    const final = m("final", "Court 1", "2026-12-01T09:40", [], ["concluded", "semiB"]);
    const result = cascadeReschedule([semiB, final], concluded, at("2026-12-01T09:50"), REST, 40); // semiA ran 10 min long
    // semiB's assumed finish (09:40) < semiA's real finish (09:50) — floor is 09:50.
    expect(result.get("final")).toEqual(at("2026-12-01T09:50"));
  });

  it("ignores an unresolvable feeder (neither the concluded match nor another match here) rather than blocking the match", () => {
    const concluded = concludedOn("Court 1", "2026-12-01T09:00");
    const final = m("final", "Court 2", "2026-12-01T09:00", [], ["someOtherMatch", ""]);
    const result = cascadeReschedule([final], concluded, at("2026-12-01T09:15"), REST, 40);
    expect(result.has("final")).toBe(false);
  });

  it("leaves a match with no feeders untouched by the feeder rule", () => {
    const concluded = concludedOn("Court 1", "2026-12-01T09:00");
    const roundRobinMatch = m("rr", "Court 2", "2026-12-01T09:00");
    const result = cascadeReschedule([roundRobinMatch], concluded, at("2026-12-01T09:15"), REST, 40);
    expect(result.has("rr")).toBe(false);
  });
});
