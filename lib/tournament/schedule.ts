import type { DrawFormat, MatchStatus } from "@prisma/client";
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

/**
 * "Tue, Dec 1 · 9:30 AM · Court 2", or null if the match has no time yet. A
 * scheduled time is only ever a plan until the match actually gets underway,
 * so it's prefixed "est." (estimated) until then — once `status` or
 * `liveStartedAt` shows the match has started, the prefix drops, since the
 * time is now just historical context rather than a claim about the future.
 * Both are optional and default to "not started" (so the prefix shows) for
 * callers that don't have that information at hand.
 */
export function formatScheduleLabel(slot: {
  scheduledAt: Date | null;
  court: string | null;
  status?: unknown;
  liveStartedAt?: Date | null;
}): string | null {
  if (!slot.scheduledAt) return null;
  const parts = [shortDayFormatter.format(slot.scheduledAt), formatTimeOfDay(slot.scheduledAt)];
  if (slot.court) parts.push(slot.court);
  const label = parts.join(" · ");
  const started = (slot.status ?? null) !== null || (slot.liveStartedAt ?? null) !== null;
  return started ? label : `est. ${label}`;
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

export type CourtColumn<T> = { court: string; items: T[] };

/**
 * Splits one day's already-chronologically-sorted items into one column per
 * court — numbered courts ("Court 1", "Court 2"…) in order, any other court
 * name after that, and a trailing "No court" column for anything scheduled
 * without one. Each column keeps its items in the original (chronological)
 * order. The grid view in the Match Center is one of these per day.
 */
export function courtColumns<T extends { court: string | null }>(items: readonly T[]): CourtColumn<T>[] {
  const NO_COURT = "\u0000no-court";
  const byCourt = new Map<string, T[]>();
  for (const item of items) {
    const key = item.court ?? NO_COURT;
    const bucket = byCourt.get(key);
    if (bucket) bucket.push(item);
    else byCourt.set(key, [item]);
  }
  return [...byCourt.entries()]
    .sort(([a], [b]) => {
      if (a === NO_COURT) return 1;
      if (b === NO_COURT) return -1;
      return compareCourts(a, b);
    })
    .map(([court, courtItems]) => ({ court: court === NO_COURT ? "No court" : court, items: courtItems }));
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

// --- Estimated scheduling ---------------------------------------------------
//
// A greedy list-scheduling simulation: no court is ever assigned in advance
// (the organizer picks one when actually calling a match), but "how many
// interchangeable courts are there" is exactly what determines how matches
// queue up, so the simulation still needs to reason about court contention to
// produce a realistic estimate. Courts are anonymous resources in the output
// — only a start time comes out per match.

export type ScheduleMatchInput = {
  matchId: string;
  eventId: string;
  drawFormat: DrawFormat;
  /** Pool matches (and pure round robin) all sit at one round with no feeders; a bracket round only ever feeds from the same event's previous round. */
  round: number;
  /** Used only to break ties deterministically within the same round/priority. */
  position: number;
  /** Round R (R >= 2) position P is fed by round R-1's positions 2P and 2P+1. Null for round 1, pool, and round-robin matches — none of those wait on anything. */
  feederMatchIds: readonly [string, string] | null;
  isBye: boolean;
  status: MatchStatus | null;
  /**
   * Registered-player identity keys (e.g. userId; a doubles pair has two) for
   * each side, once known. Null while a feeder hasn't resolved yet — the slot
   * still gets an estimate (from court + feeder timing alone), just no rest
   * constraint, since who's actually playing isn't decided yet. A guest
   * player (no account) has no reliable cross-entry identity, so they don't
   * contribute a rest constraint either — pass an empty array for them.
   */
  entry1PlayerKeys: readonly string[] | null;
  entry2PlayerKeys: readonly string[] | null;
  /** When the match actually began (venue-local floating time, like scheduledAt) — null if it hasn't started. */
  actualStart: Date | null;
  /** When a result was actually recorded (also set for a walkover/retirement — the slot resolves the moment it's decided, not when play would have ended). Null if unplayed. */
  actualEnd: Date | null;
};

export type ScheduleConfig = {
  courts: number;
  /** Nothing is ever estimated to start before this (also floored to `now`). */
  dayStart: Date;
  matchDurationMinutes?: number;
  changeoverMinutes?: number;
  minRestMinutes?: number;
};

export type ScheduleEstimate = {
  matchId: string;
  estimatedStart: Date;
  /** How many other not-yet-started matches are estimated to start before this one — a rough proxy for how far a hold-up upstream could push it back. */
  queueDepth: number;
};

/** Also the fallback assumed duration for cascadeReschedule's feeder-floor check, whose caller doesn't have a per-schedule duration to reuse. */
export const DEFAULT_MATCH_DURATION_MINUTES = 45;
const DEFAULT_CHANGEOVER_MINUTES = 5;
/** Also the fallback rest floor for cascadeReschedule, whose caller doesn't have a per-schedule rest value to reuse. */
export const DEFAULT_MIN_REST_MINUTES = 25;

/**
 * Estimates a start time for every not-yet-started match, via greedy list
 * scheduling: process matches in an order that's always dependency-safe
 * (round ascending — a bracket round only ever depends on the same event's
 * earlier round, and pool/round-robin matches all share one round with no
 * dependency at all), breaking ties by giving priority to whichever event
 * has the most rounds still ahead of it so it doesn't fall behind. Each match
 * is assigned to whichever of the `courts` interchangeable slots frees up
 * soonest, no earlier than its feeders are done and both its players (once
 * known) have rested.
 *
 * Pure and deterministic: every "now" the simulation needs (day start,
 * current time, feeders still in progress) is passed in, never read from the
 * clock. Re-run it with the current DB state whenever a match starts or ends
 * to get a fresh estimate.
 */
export function estimateMatchSchedule(matches: ScheduleMatchInput[], config: ScheduleConfig, now: Date): ScheduleEstimate[] {
  const durationMs = (config.matchDurationMinutes ?? DEFAULT_MATCH_DURATION_MINUTES) * 60_000;
  const changeoverMs = (config.changeoverMinutes ?? DEFAULT_CHANGEOVER_MINUTES) * 60_000;
  const restMs = (config.minRestMinutes ?? DEFAULT_MIN_REST_MINUTES) * 60_000;
  const floorTime = Math.max(config.dayStart.getTime(), now.getTime());

  // How many rounds each event's bracket portion has, for the priority
  // tiebreak — pool/round-robin matches get a flat, low priority instead (no
  // sequential rounds to fall behind on). Pool matches sit at round 0, always
  // lower than any real bracket round, so they never affect this max.
  const totalRoundsByEvent = new Map<string, number>();
  for (const m of matches) {
    totalRoundsByEvent.set(m.eventId, Math.max(totalRoundsByEvent.get(m.eventId) ?? 0, m.round));
  }

  const remainingRounds = (m: ScheduleMatchInput): number => {
    if (m.drawFormat === "ROUND_ROBIN") return 1;
    // A pools+knockout match at round 0 is a pool match (no bracket rounds).
    if (m.round === 0) return 1;
    const total = totalRoundsByEvent.get(m.eventId) ?? m.round;
    return total - m.round + 1;
  };

  // Court availability: a live match (actualStart, no actualEnd yet) ties up
  // one court until an estimated finish; every other court is free right now.
  const liveNow = matches.filter((m) => m.actualStart !== null && m.actualEnd === null);
  const courtFree: number[] = [
    ...liveNow.slice(0, config.courts).map((m) => m.actualStart!.getTime() + durationMs),
    ...Array(Math.max(0, config.courts - liveNow.length)).fill(floorTime),
  ];

  // Player availability: free from `floorTime` unless we've seen them in a
  // finished or in-progress match, in which case they need to rest after it.
  const playerFreeAt = new Map<string, number>();
  const bumpPlayer = (key: string, at: number) => playerFreeAt.set(key, Math.max(playerFreeAt.get(key) ?? -Infinity, at));
  const restFloorFor = (keys: readonly string[] | null): number =>
    keys && keys.length > 0 ? Math.max(...keys.map((k) => playerFreeAt.get(k) ?? -Infinity)) : -Infinity;

  // A match's finish time, actual once played, else estimated once assigned
  // below — read by whatever it feeds into.
  const finishTime = new Map<string, number>();

  for (const m of matches) {
    const keys = [...(m.entry1PlayerKeys ?? []), ...(m.entry2PlayerKeys ?? [])];
    if (m.actualEnd) {
      finishTime.set(m.matchId, m.actualEnd.getTime());
      for (const k of keys) bumpPlayer(k, m.actualEnd.getTime() + restMs);
    } else if (m.actualStart) {
      const finish = m.actualStart.getTime() + durationMs;
      finishTime.set(m.matchId, finish);
      for (const k of keys) bumpPlayer(k, finish + restMs);
    } else if (m.isBye) {
      finishTime.set(m.matchId, floorTime);
    }
  }

  // Greedy list scheduling: repeatedly pick the highest-priority match among
  // whatever's currently ready (dependency-wise) and assign it — never a
  // single upfront sort, since round number alone isn't comparable *across*
  // events (a final at round 3 in one event can easily be more urgent than a
  // first-round match in another) and completing a match can freshly unlock
  // whatever it feeds into.
  const remaining = new Map(
    matches.filter((m) => !m.isBye && m.status === null && m.actualStart === null).map((m) => [m.matchId, m]),
  );
  const isReady = (m: ScheduleMatchInput): boolean =>
    m.feederMatchIds === null || m.feederMatchIds.every((id) => finishTime.has(id));
  const higherPriority = (a: ScheduleMatchInput, b: ScheduleMatchInput): boolean => {
    const ra = remainingRounds(a);
    const rb = remainingRounds(b);
    if (ra !== rb) return ra > rb;
    if (a.eventId !== b.eventId) return a.eventId < b.eventId;
    return a.position < b.position;
  };

  const estimates: ScheduleEstimate[] = [];
  while (remaining.size > 0) {
    let next: ScheduleMatchInput | null = null;
    for (const m of remaining.values()) {
      if (!isReady(m)) continue;
      if (next === null || higherPriority(m, next)) next = m;
    }
    // Nothing ready is a malformed input (a feeder cycle, or one that's
    // missing from `matches` entirely) — stop rather than loop forever.
    if (!next) break;
    remaining.delete(next.matchId);

    const feederFloor = next.feederMatchIds
      ? Math.max(finishTime.get(next.feederMatchIds[0])!, finishTime.get(next.feederMatchIds[1])!)
      : floorTime;
    const readyAt = Math.max(floorTime, feederFloor, restFloorFor(next.entry1PlayerKeys), restFloorFor(next.entry2PlayerKeys));

    let bestCourt = 0;
    for (let i = 1; i < courtFree.length; i++) {
      if (courtFree[i] < courtFree[bestCourt]) bestCourt = i;
    }
    const start = Math.max(readyAt, courtFree[bestCourt]);
    courtFree[bestCourt] = start + durationMs + changeoverMs;

    const finish = start + durationMs;
    finishTime.set(next.matchId, finish);
    for (const k of next.entry1PlayerKeys ?? []) bumpPlayer(k, finish + restMs);
    for (const k of next.entry2PlayerKeys ?? []) bumpPlayer(k, finish + restMs);

    estimates.push({ matchId: next.matchId, estimatedStart: new Date(start), queueDepth: 0 });
  }

  // Fill in queueDepth now that every estimate is known.
  const byStart = [...estimates].sort((a, b) => a.estimatedStart.getTime() - b.estimatedStart.getTime());
  byStart.forEach((e, i) => {
    e.queueDepth = i;
  });

  return estimates;
}

/** A rough uncertainty window for an estimate: wider the more matches are queued ahead of it, capped at an hour. */
export function estimatedRangeMinutes(queueDepth: number): number {
  return Math.min(10 + queueDepth * 5, 60);
}

/** "~2:15 PM (± 20 min)" */
export function formatEstimatedLabel(estimatedStart: Date, queueDepth: number): string {
  return `~${formatTimeOfDay(estimatedStart)} (± ${estimatedRangeMinutes(queueDepth)} min)`;
}

export type CourtScheduleMatchInput = {
  matchId: string;
  /** Registered-player identity keys for each side, combined (a guest or TBD side contributes none). */
  playerKeys: readonly string[];
  /**
   * Round R (R >= 2) position P is fed by the same event's round R-1,
   * positions 2P and 2P+1 — null for round 1, pool, and round-robin matches,
   * none of which wait on anything. A final can't start before both feeders
   * are decided, even if a court is sitting empty for it.
   */
  feederMatchIds?: readonly [string, string] | null;
};

/** An already-fixed booking (outside the batch being placed) on one of the numbered courts 1..courts. */
export type CourtBusyInterval = {
  court: number;
  start: Date;
  end: Date;
};

export type CourtScheduleConfig = {
  courts: number;
  start: Date;
  matchDurationMinutes: number;
  /** Minimum rest a player needs before their next match — checked across every match they're in, not just this batch. */
  minRestMinutes: number;
  /**
   * Per-player "not before" floor from matches outside this batch (already
   * scheduled elsewhere, in progress, or played) — e.g. a men's singles match
   * that ends at 9:40 should push that player's men's doubles match (booked
   * in a separate export) to no earlier than 9:40 + rest, even though the
   * doubles match itself is nowhere in `matches`.
   */
  priorBusyUntil?: ReadonlyMap<string, Date>;
  /**
   * Other matches already pinned to one of the numbered courts (a previous
   * export, a manually-assigned court, or one currently live) — this batch
   * schedules around them instead of double-booking the same court at an
   * overlapping time. A court outside 1..courts is ignored (nothing here can
   * collide with it).
   */
  priorCourtBusy?: readonly CourtBusyInterval[];
  /**
   * Known or assumed finish time for a feeder match that isn't itself part of
   * this batch (already played, live, or scheduled in an earlier export) — a
   * feeder that *is* in this batch doesn't need an entry here, since its
   * finish is computed as this batch is laid out. A feeder missing from both
   * places is treated as having no constraint (nothing to be ready after),
   * rather than blocking the match that depends on it.
   */
  priorFinishTimes?: ReadonlyMap<string, Date>;
};

export type CourtScheduleResult = {
  matchId: string;
  start: Date;
  /** 1-based — pass to courtName() for the "Court N" string to store. */
  court: number;
};

/** The earliest time >= readyAt that a durationMs-long slot fits in the gaps of a sorted, non-overlapping interval list. */
function earliestFreeSlot(busy: readonly { start: number; end: number }[], readyAt: number, durationMs: number): number {
  let candidate = readyAt;
  for (const interval of busy) {
    if (candidate + durationMs <= interval.start) break;
    if (candidate < interval.end) candidate = interval.end;
  }
  return candidate;
}

/**
 * Assigns each of `matches` (processed in the given order — the caller's
 * chosen event/round/position order, not re-prioritized) a start time and a
 * specific numbered court: whichever of `courts` has the earliest opening, no
 * earlier than every player involved has rested `minRestMinutes` since their
 * last match — either earlier in this same batch, or from `priorBusyUntil` —
 * and, if it has feeders, no earlier than both of those are decided (an empty
 * court doesn't help a final that can't be played yet). Ties for "earliest
 * opening" go to the lower-numbered court. This naturally spreads the batch
 * evenly across the available courts, and never overlaps a court booking from
 * `priorCourtBusy`.
 *
 * `matches` should list a round before whatever in this same batch feeds from
 * it, so that round's finish times are already known when they're needed —
 * the same event/round/position order callers already use here.
 *
 * Used for the organizer's manual "schedule a day" / "reschedule" tool — the
 * one place in this app that assigns a real court number in advance, since
 * the whole point of a bulk export is to hand back a day's court-by-court
 * plan (see the grid view in the Match Center), not just per-match estimates.
 */
export function distributeAcrossCourts(
  matches: readonly CourtScheduleMatchInput[],
  config: CourtScheduleConfig,
): CourtScheduleResult[] {
  const durationMs = config.matchDurationMinutes * 60_000;
  const restMs = config.minRestMinutes * 60_000;
  const startMs = config.start.getTime();

  const courtBusy: { start: number; end: number }[][] = Array.from({ length: config.courts }, () => []);
  for (const obstacle of config.priorCourtBusy ?? []) {
    const idx = obstacle.court - 1;
    if (idx >= 0 && idx < config.courts) {
      courtBusy[idx].push({ start: obstacle.start.getTime(), end: obstacle.end.getTime() });
    }
  }
  for (const busy of courtBusy) busy.sort((a, b) => a.start - b.start);

  const playerFreeAt = new Map<string, number>();
  for (const [key, until] of config.priorBusyUntil ?? []) {
    playerFreeAt.set(key, until.getTime());
  }
  const finishTime = new Map<string, number>();
  for (const [id, date] of config.priorFinishTimes ?? []) {
    finishTime.set(id, date.getTime());
  }

  const results: CourtScheduleResult[] = [];
  for (const m of matches) {
    const restFloor = m.playerKeys.length > 0 ? Math.max(...m.playerKeys.map((k) => playerFreeAt.get(k) ?? -Infinity)) : -Infinity;
    const feederFloor = m.feederMatchIds
      ? Math.max(finishTime.get(m.feederMatchIds[0]) ?? -Infinity, finishTime.get(m.feederMatchIds[1]) ?? -Infinity)
      : -Infinity;
    const readyAt = Math.max(startMs, restFloor, feederFloor);

    let bestCourt = 0;
    let bestStart = earliestFreeSlot(courtBusy[0], readyAt, durationMs);
    for (let i = 1; i < courtBusy.length; i++) {
      const start = earliestFreeSlot(courtBusy[i], readyAt, durationMs);
      if (start < bestStart) {
        bestStart = start;
        bestCourt = i;
      }
    }

    const interval = { start: bestStart, end: bestStart + durationMs };
    const insertAt = courtBusy[bestCourt].findIndex((b) => b.start > interval.start);
    if (insertAt === -1) courtBusy[bestCourt].push(interval);
    else courtBusy[bestCourt].splice(insertAt, 0, interval);

    for (const k of m.playerKeys) playerFreeAt.set(k, Math.max(playerFreeAt.get(k) ?? -Infinity, interval.end + restMs));
    finishTime.set(m.matchId, interval.end);

    results.push({ matchId: m.matchId, start: new Date(bestStart), court: bestCourt + 1 });
  }
  return results;
}

export type CascadeScheduledMatch = {
  matchId: string;
  scheduledAt: Date;
  court: string | null;
  playerKeys: readonly string[];
  /** Round R (R >= 2) position P is fed by the same event's round R-1, positions 2P and 2P+1 — null for round 1, pool, and round-robin matches. */
  feederMatchIds?: readonly [string, string] | null;
};

export type ConcludedMatch = {
  matchId: string;
  scheduledAt: Date;
  court: string | null;
  playerKeys: readonly string[];
};

/**
 * A match's actual finish rarely lands exactly on its assumed one, so once it
 * concludes, everything already scheduled behind it should move with it:
 *  - every not-yet-played match still queued after it on the same court
 *    shifts by exactly how early or late it ran, preserving whatever gaps
 *    (including any rest padding) the schedule already had between them;
 *  - any other still-scheduled match sharing a player with the one that just
 *    concluded, on a different court, is pushed later if it would otherwise
 *    start before that player has rested `minRestMinutes` since the real
 *    finish — never pulled earlier, since extra rest is never a problem, and
 *    a push cascades to whatever else is queued behind it on its own court;
 *  - finally, any match with feeders — the concluded one, or another match
 *    here — is never left earlier than both are done: an early finish on one
 *    court can't drag a final (queued behind it on that same court) ahead of
 *    a semifinal still running on a different one. A feeder still to be
 *    played is assumed to take `matchDurationMinutes`, the same convention
 *    used when a schedule is first laid out.
 * Only same-day matches are considered for the first two rules (a different
 * day's plan is unrelated) — the feeder rule isn't day-scoped, since a
 * bracket dependency doesn't reset overnight. Each rule sees the results of
 * the ones before it, but a match moved by the rest push or the feeder floor
 * doesn't itself trigger a further rest check. Returns just the matches that
 * actually need a new time.
 */
export function cascadeReschedule(
  others: readonly CascadeScheduledMatch[],
  concluded: ConcludedMatch,
  actualEnd: Date,
  minRestMinutes: number,
  matchDurationMinutes: number = DEFAULT_MATCH_DURATION_MINUTES,
): Map<string, Date> {
  const restMs = minRestMinutes * 60_000;
  const durationMs = matchDurationMinutes * 60_000;
  const sameDay = others.filter((m) => dayKey(m.scheduledAt) === dayKey(concluded.scheduledAt));
  const result = new Map<string, Date>();
  const currentTime = (m: CascadeScheduledMatch) => (result.get(m.matchId) ?? m.scheduledAt).getTime();

  const sameCourtChain = (from: CascadeScheduledMatch | ConcludedMatch, court: string) =>
    sameDay
      .filter((m) => m.court === court && m.scheduledAt.getTime() >= from.scheduledAt.getTime())
      .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());

  // Same-court cascade: shift everything queued after the concluded match on
  // its own court by how early or late it actually finished.
  if (concluded.court !== null) {
    const queued = sameDay
      .filter((m) => m.court === concluded.court && m.scheduledAt.getTime() > concluded.scheduledAt.getTime())
      .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
    const next = queued[0];
    if (next) {
      const delta = actualEnd.getTime() - next.scheduledAt.getTime();
      if (delta !== 0) {
        for (const m of queued) result.set(m.matchId, new Date(m.scheduledAt.getTime() + delta));
      }
    }
  }

  // Cross-court rest floor: push out (never pull in) any other scheduled
  // match sharing a player with the one that just concluded.
  if (concluded.playerKeys.length > 0) {
    const restFloor = actualEnd.getTime() + restMs;
    for (const m of sameDay) {
      if (concluded.court !== null && m.court === concluded.court) continue; // handled above
      if (!m.playerKeys.some((k) => concluded.playerKeys.includes(k))) continue;
      if (currentTime(m) >= restFloor) continue;
      const pushDelta = restFloor - currentTime(m);
      const chain = m.court !== null ? sameCourtChain(m, m.court) : [m];
      for (const queued of chain) result.set(queued.matchId, new Date(currentTime(queued) + pushDelta));
    }
  }

  // Feeder floor: a match can't start before both its feeders are decided —
  // checked against the concluded match's real finish, or another match
  // here's own (possibly just-shifted) time plus an assumed duration.
  const byId = new Map(others.map((m) => [m.matchId, m]));
  for (const m of sameDay) {
    if (!m.feederMatchIds) continue;
    let feederFloor = -Infinity;
    for (const feederId of m.feederMatchIds) {
      if (feederId === "") continue;
      if (feederId === concluded.matchId) {
        feederFloor = Math.max(feederFloor, actualEnd.getTime());
        continue;
      }
      const feeder = byId.get(feederId);
      if (feeder) feederFloor = Math.max(feederFloor, currentTime(feeder) + durationMs);
    }
    if (feederFloor !== -Infinity && currentTime(m) < feederFloor) {
      result.set(m.matchId, new Date(feederFloor));
    }
  }

  return result;
}
