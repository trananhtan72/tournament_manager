import type { DrawFormat } from "@prisma/client";
import { roundName } from "./singleElimination";

// A match's scheduled time is a "floating" wall-clock time: the UTC fields of
// the stored Date hold the venue's local time (the same way tournament dates
// are UTC midnight), so it is always parsed, formatted and compared in UTC and
// never shifts with the server's or the viewer's time zone.

const DATETIME_LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/** Parses an <input type="datetime-local"> value ("2026-12-01T09:30"); null if malformed or not a real date/time. */
export function parseDateTimeLocal(value: string): Date | null {
  const match = DATETIME_LOCAL.exec(value.trim());
  if (!match) return null;
  const [year, month, day, hour, minute] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const roundTrips =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day &&
    date.getUTCHours() === hour &&
    date.getUTCMinutes() === minute;
  return roundTrips ? date : null;
}

/** The value to put back into an <input type="datetime-local">. */
export function toDateTimeLocal(date: Date): string {
  return date.toISOString().slice(0, 16);
}

/** "2026-12-01" — the calendar day a time falls on. Sorts chronologically as a string. */
export function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function isWithinTournamentDays(scheduledAt: Date, startDate: Date, endDate: Date): boolean {
  const day = dayKey(scheduledAt);
  return day >= dayKey(startDate) && day <= dayKey(endDate);
}

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "UTC",
});
const dayHeadingFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
const shortDayFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

export function formatTimeOfDay(date: Date): string {
  return timeFormatter.format(date);
}

/** "Tuesday, Dec 1" */
export function formatDayHeading(date: Date): string {
  return dayHeadingFormatter.format(date);
}

/** "Tue, Dec 1 · 9:30 AM · Court 2", or null if the match has no time yet. */
export function formatScheduleLabel(slot: { scheduledAt: Date | null; court: string | null }): string | null {
  if (!slot.scheduledAt) return null;
  const parts = [shortDayFormatter.format(slot.scheduledAt), formatTimeOfDay(slot.scheduledAt)];
  if (slot.court) parts.push(slot.court);
  return parts.join(" · ");
}

/**
 * "2026-12-01T09:05" from a Date read in the device's own time zone. The
 * organizer's phone is at the venue, so its clock is the venue's wall-clock
 * time — the same "floating" kind of time the schedule uses.
 */
export function dateTimeLocalFromDevice(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** "Started Tue, Dec 1 · 9:07 AM", or null if it has no start time. */
export function formatStartedLabel(startedAt: Date | null): string | null {
  if (!startedAt) return null;
  return `Started ${shortDayFormatter.format(startedAt)} · ${formatTimeOfDay(startedAt)}`;
}

/** Natural order ("Court 2" before "Court 10"); matches without a court go last. */
export function compareCourts(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a.localeCompare(b, "en", { numeric: true, sensitivity: "base" });
}

export type ScheduleSortable = {
  scheduledAt: Date;
  court: string | null;
  eventName: string;
  round: number;
  position: number;
};

/** Chronological, then by court, then a stable event/round/position order. Returns a new array. */
export function sortSchedule<T extends ScheduleSortable>(items: T[]): T[] {
  return [...items].sort(
    (a, b) =>
      a.scheduledAt.getTime() - b.scheduledAt.getTime() ||
      compareCourts(a.court, b.court) ||
      a.eventName.localeCompare(b.eventName, "en", { numeric: true }) ||
      a.round - b.round ||
      a.position - b.position,
  );
}

export type ScheduleDay<T> = { day: string; date: Date; items: T[] };

/** Groups already-sorted items by calendar day, keeping their order. */
export function groupByDay<T extends { scheduledAt: Date }>(sortedItems: T[]): ScheduleDay<T>[] {
  const days: ScheduleDay<T>[] = [];
  for (const item of sortedItems) {
    const day = dayKey(item.scheduledAt);
    const last = days[days.length - 1];
    if (last && last.day === day) {
      last.items.push(item);
    } else {
      days.push({ day, date: item.scheduledAt, items: [item] });
    }
  }
  return days;
}

/** How many rounds the knockout/single-elimination part of an event has (pool matches don't count). */
export function knockoutRoundCount(matches: { poolId: string | null; round: number }[]): number {
  return matches.reduce((max, m) => (m.poolId === null ? Math.max(max, m.round) : max), 0);
}

/** "Pool A", "Round robin", "Semifinals"… — where in the event a match sits. */
export function stageLabel(
  match: { poolName: string | null; round: number },
  event: { drawFormat: DrawFormat; knockoutRounds: number },
): string {
  if (match.poolName) return match.poolName;
  if (event.drawFormat === "ROUND_ROBIN") return "Round robin";
  return roundName(match.round, event.knockoutRounds);
}
