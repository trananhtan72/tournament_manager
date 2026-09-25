import { describe, expect, it } from "vitest";
import {
  compareCourts,
  dateTimeLocalFromDevice,
  dayKey,
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
  it("formats time, day heading and the combined label in UTC", () => {
    expect(plain(formatTimeOfDay(at("2026-12-01T09:30")))).toBe("9:30 AM");
    expect(plain(formatTimeOfDay(at("2026-12-01T18:05")))).toBe("6:05 PM");
    expect(formatDayHeading(at("2026-12-01T09:30"))).toBe("Tuesday, Dec 1");
    expect(plain(formatScheduleLabel({ scheduledAt: at("2026-12-01T09:30"), court: "Court 2" }))).toBe(
      "Tue, Dec 1 · 9:30 AM · Court 2",
    );
  });

  it("omits the court when there isn't one, and is null with no time", () => {
    expect(plain(formatScheduleLabel({ scheduledAt: at("2026-12-01T09:30"), court: null }))).toBe("Tue, Dec 1 · 9:30 AM");
    expect(formatScheduleLabel({ scheduledAt: null, court: "Court 1" })).toBeNull();
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
