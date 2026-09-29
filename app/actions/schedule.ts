"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { revalidateTournament } from "@/lib/revalidate";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { formatDate } from "@/lib/formatDate";
import { dayKey, distributeAcrossCourts, isWithinTournamentDays, parseDateTimeLocal } from "@/lib/tournament/schedule";
import { courtName, parseCourtNumber } from "@/lib/tournament/courts";

export type ScheduleActionState = { error?: string; saved?: boolean };

const scheduleSchema = z.object({
  scheduledAt: z.string().trim(),
  court: z
    .string()
    .trim()
    .transform((court) => court.replace(/\s+/g, " "))
    .pipe(z.string().max(40, "Court name is too long (40 characters max)")),
});

/** Sets (or, with both fields blank, clears) a match's time and court. */
export async function setMatchSchedule(
  matchId: string,
  _prevState: ScheduleActionState,
  formData: FormData,
): Promise<ScheduleActionState> {
  const userId = await requireUserId();

  const parsed = scheduleSchema.safeParse({
    scheduledAt: String(formData.get("scheduledAt") ?? ""),
    court: String(formData.get("court") ?? ""),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { event: { include: { tournament: true } } },
  });
  if (!match || match.event.tournament.organizerId !== userId) {
    return { error: "Match not found." };
  }
  if (match.isBye) {
    return { error: "A bye isn't played, so it can't be scheduled." };
  }

  const { scheduledAt: rawTime, court } = parsed.data;
  if (!rawTime && court) {
    return { error: "Set a time before assigning a court." };
  }

  let scheduledAt: Date | null = null;
  if (rawTime) {
    scheduledAt = parseDateTimeLocal(rawTime);
    if (!scheduledAt) {
      return { error: "Enter a valid date and time." };
    }
    const { startDate, endDate } = match.event.tournament;
    if (!isWithinTournamentDays(scheduledAt, startDate, endDate)) {
      return {
        error: `Pick a time on a tournament day (${formatDate(startDate)} – ${formatDate(endDate)}).`,
      };
    }
  }

  await prisma.match.update({
    where: { id: matchId },
    data: { scheduledAt, court: court || null },
  });

  const { slug } = match.event.tournament;
  revalidateTournament(slug);
  revalidatePath("/dashboard");
  return { saved: true };
}

export type BulkScheduleActionState = { error?: string; scheduledCount?: number; resetCount?: number };

const bulkScheduleSchema = z.object({
  date: z.string().trim().min(1, "Enter a date"),
  startTime: z.string().trim().min(1, "Enter a start time"),
  durationMinutes: z.coerce.number().int().min(5, "Minutes per match must be at least 5"),
  minRestMinutes: z.coerce.number().int().min(0, "Rest can't be negative"),
});

const playerKeysFor = (entry: { players: { userId: string | null }[] } | null): readonly string[] =>
  entry ? entry.players.map((p) => p.userId).filter((id): id is string => id !== null) : [];

/**
 * One form, two things it can do with the checked matches — distinguished by
 * which submit button fired it (the "intent" field), the same way
 * StartLiveForm tells its two buttons apart. A form can only cleanly bind to
 * one server action at a time (a second useActionState wired to a sibling
 * button's formAction was tried first and silently dropped every submission
 * — Next's server-action wiring doesn't reliably support two different bound
 * actions sharing one form), so both paths go through this single action.
 */
export async function bulkScheduleMatches(
  tournamentId: string,
  prevState: BulkScheduleActionState,
  formData: FormData,
): Promise<BulkScheduleActionState> {
  if (String(formData.get("intent") ?? "schedule") === "reset") {
    return resetScheduledMatches(tournamentId, prevState, formData);
  }
  return scheduleCheckedMatches(tournamentId, formData);
}

/**
 * Assigns (or reassigns) a start time and court to the checked matches for
 * one day, spread evenly across the tournament's courts (lower-numbered
 * courts filled first) — a manual "plan/replan a day" tool, distinct from the
 * live/estimated schedule elsewhere: it only ever runs when the organizer
 * asks, on exactly the matches they picked.
 *
 * "Minimum rest" is a per-player constraint, not a flat gap between matches:
 * it's checked against every match a player is in across the whole
 * tournament — including one outside this batch (already scheduled, live, or
 * played) — so e.g. a men's singles match doesn't get immediately followed
 * by that same player's doubles match just because they're different events.
 * Court assignment similarly schedules around any other same-day match that's
 * already pinned to a numbered court, rather than double-booking it.
 */
async function scheduleCheckedMatches(tournamentId: string, formData: FormData): Promise<BulkScheduleActionState> {
  const userId = await requireUserId();

  const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!tournament || tournament.organizerId !== userId) {
    return { error: "Tournament not found." };
  }

  const parsed = bulkScheduleSchema.safeParse({
    date: String(formData.get("date") ?? ""),
    startTime: String(formData.get("startTime") ?? ""),
    durationMinutes: formData.get("durationMinutes"),
    minRestMinutes: formData.get("minRestMinutes"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const matchIds = formData
    .getAll("matchIds")
    .map(String)
    .filter((id) => id !== "");
  if (matchIds.length === 0) {
    return { error: "Select at least one match to schedule." };
  }

  const start = parseDateTimeLocal(`${parsed.data.date}T${parsed.data.startTime}`);
  if (!start) return { error: "Enter a valid date and start time." };
  if (!isWithinTournamentDays(start, tournament.startDate, tournament.endDate)) {
    return { error: `Pick a date within the tournament (${formatDate(tournament.startDate)} – ${formatDate(tournament.endDate)}).` };
  }

  // Re-derived from the database (event name, then round/position) rather
  // than trusted from form field order, so the schedule this produces is
  // always the same regardless of how the request was assembled.
  const matches = await prisma.match.findMany({
    where: { id: { in: matchIds }, event: { tournamentId } },
    select: {
      id: true,
      eventId: true,
      round: true,
      position: true,
      poolId: true,
      isBye: true,
      status: true,
      scheduledAt: true,
      event: { select: { name: true } },
      entry1: { select: { players: { select: { userId: true } } } },
      entry2: { select: { players: { select: { userId: true } } } },
    },
  });
  if (matches.length !== matchIds.length) {
    return { error: "One of the selected matches couldn't be found." };
  }
  const schedulable = matches.filter((m) => !m.isBye && m.status === null);
  if (schedulable.length === 0) {
    return { error: "None of the selected matches can be scheduled — they've already been played, or are byes." };
  }
  const ordered = [...schedulable].sort(
    (a, b) => a.event.name.localeCompare(b.event.name, "en", { numeric: true }) || a.round - b.round || a.position - b.position,
  );
  const orderedIds = ordered.map((m) => m.id);
  const matchPlayerKeys = new Map(ordered.map((m) => [m.id, [...playerKeysFor(m.entry1), ...playerKeysFor(m.entry2)]]));
  const batchPlayerKeys = new Set([...matchPlayerKeys.values()].flat());

  // Feeder lookup: a bracket match (poolId null) at round R (R >= 2),
  // position P is fed by the same event's round R-1, positions 2P and 2P+1 —
  // built from every match in the events involved, since a feeder might not
  // be part of this batch (e.g. only the final was checked). Pool and
  // round-robin matches, and every round 1, never have one.
  const eventIds = [...new Set(ordered.map((m) => m.eventId))];
  const eventMatches = await prisma.match.findMany({
    where: { eventId: { in: eventIds } },
    select: { id: true, eventId: true, round: true, position: true, poolId: true },
  });
  const byEventRoundPosition = new Map<string, string>();
  for (const m of eventMatches) {
    if (m.poolId === null) byEventRoundPosition.set(`${m.eventId}:${m.round}:${m.position}`, m.id);
  }
  const feederMatchIdsFor = (m: (typeof ordered)[number]): readonly [string, string] | null =>
    m.poolId === null && m.round >= 2
      ? [
          byEventRoundPosition.get(`${m.eventId}:${m.round - 1}:${m.position * 2}`) ?? "",
          byEventRoundPosition.get(`${m.eventId}:${m.round - 1}:${m.position * 2 + 1}`) ?? "",
        ]
      : null;
  const matchFeederIds = new Map(ordered.map((m) => [m.id, feederMatchIdsFor(m)]));

  // Other matches (anywhere in the tournament, not part of this batch, not a
  // bye) with some known timing — these act as fixed points this batch reads
  // from, but doesn't itself touch. Every one of them can pin a court and can
  // be a feeder's finish time (regardless of what day it's on — a bracket
  // dependency doesn't reset overnight the way rest or a day's court usage
  // does); only one on the same day, sharing a player with the batch, also
  // imposes a rest floor.
  const otherMatches = await prisma.match.findMany({
    where: {
      event: { tournamentId },
      id: { notIn: orderedIds },
      isBye: false,
      OR: [{ scheduledAt: { not: null } }, { actualEnd: { not: null } }, { liveStartedAt: { not: null } }],
    },
    select: {
      id: true,
      court: true,
      scheduledAt: true,
      startedAt: true,
      actualEnd: true,
      liveStartedAt: true,
      entry1: { select: { players: { select: { userId: true } } } },
      entry2: { select: { players: { select: { userId: true } } } },
    },
  });
  const priorBusyUntil = new Map<string, Date>();
  const priorCourtBusy: { court: number; start: Date; end: Date }[] = [];
  const priorFinishTimes = new Map<string, Date>();
  for (const m of otherMatches) {
    // A played match's actual window; else a live match's window (estimated
    // finish, since it isn't over yet); else its merely-planned window.
    let interval: { start: Date; end: Date } | null = null;
    if (m.actualEnd) {
      interval = { start: m.startedAt ?? m.scheduledAt ?? m.actualEnd, end: m.actualEnd };
    } else if (m.liveStartedAt) {
      interval = { start: m.liveStartedAt, end: new Date(m.liveStartedAt.getTime() + parsed.data.durationMinutes * 60_000) };
    } else if (m.scheduledAt) {
      interval = { start: m.scheduledAt, end: new Date(m.scheduledAt.getTime() + parsed.data.durationMinutes * 60_000) };
    }
    if (!interval) continue;

    priorFinishTimes.set(m.id, interval.end);

    // Rest and court-conflict are day-scoped (a different day's plan is
    // unrelated); a feeder's finish, recorded just above, isn't.
    if (dayKey(interval.start) !== dayKey(start)) continue;

    const courtNumber = parseCourtNumber(m.court);
    if (courtNumber !== null && courtNumber <= tournament.courtCount) {
      priorCourtBusy.push({ court: courtNumber, start: interval.start, end: interval.end });
    }

    const keys = [...playerKeysFor(m.entry1), ...playerKeysFor(m.entry2)].filter((k) => batchPlayerKeys.has(k));
    if (keys.length === 0) continue;
    const busyUntil = new Date(interval.end.getTime() + parsed.data.minRestMinutes * 60_000);
    for (const key of keys) {
      const existing = priorBusyUntil.get(key);
      if (!existing || busyUntil.getTime() > existing.getTime()) priorBusyUntil.set(key, busyUntil);
    }
  }

  const results = distributeAcrossCourts(
    ordered.map((m) => ({
      matchId: m.id,
      playerKeys: matchPlayerKeys.get(m.id)!,
      feederMatchIds: matchFeederIds.get(m.id) ?? null,
    })),
    {
      courts: tournament.courtCount,
      start,
      matchDurationMinutes: parsed.data.durationMinutes,
      minRestMinutes: parsed.data.minRestMinutes,
      priorBusyUntil,
      priorCourtBusy,
      priorFinishTimes,
    },
  );
  const resultByMatchId = new Map(results.map((r) => [r.matchId, r]));

  await prisma.$transaction(
    ordered.map((m) => {
      const result = resultByMatchId.get(m.id)!;
      return prisma.match.update({
        where: { id: m.id },
        data: { scheduledAt: result.start, court: courtName(result.court) },
      });
    }),
  );

  revalidateTournament(tournament.slug);
  revalidatePath("/dashboard");
  return { scheduledCount: ordered.length };
}

/**
 * Clears scheduledAt and court for the checked matches — the counterpart to
 * "Schedule checked matches", for when a picked date/time turns out wrong and
 * the organizer would rather start those matches over from blank than edit
 * each one individually below.
 */
async function resetScheduledMatches(
  tournamentId: string,
  _prevState: BulkScheduleActionState,
  formData: FormData,
): Promise<BulkScheduleActionState> {
  const userId = await requireUserId();

  const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!tournament || tournament.organizerId !== userId) {
    return { error: "Tournament not found." };
  }

  const matchIds = formData
    .getAll("matchIds")
    .map(String)
    .filter((id) => id !== "");
  if (matchIds.length === 0) {
    return { error: "Select at least one match to unschedule." };
  }

  const matches = await prisma.match.findMany({
    where: { id: { in: matchIds }, event: { tournamentId }, isBye: false, status: null },
    select: { id: true },
  });
  if (matches.length === 0) {
    return { error: "None of the selected matches can be unscheduled — they've already been played, or are byes." };
  }

  await prisma.match.updateMany({
    where: { id: { in: matches.map((m) => m.id) } },
    data: { scheduledAt: null, court: null },
  });

  revalidateTournament(tournament.slug);
  revalidatePath("/dashboard");
  return { resetCount: matches.length };
}

/**
 * Clears scheduledAt and court for every not-yet-played match in the
 * tournament — for throwing out the whole plan and starting over, rather than
 * checking every match individually.
 */
export async function resetAllSchedules(tournamentId: string): Promise<void> {
  const userId = await requireUserId();

  const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!tournament || tournament.organizerId !== userId) return;

  await prisma.match.updateMany({
    where: { event: { tournamentId }, isBye: false, status: null },
    data: { scheduledAt: null, court: null },
  });

  revalidateTournament(tournament.slug);
  revalidatePath("/dashboard");
}
