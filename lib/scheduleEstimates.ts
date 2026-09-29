import { prisma } from "@/lib/prisma";
import { estimateMatchSchedule, type ScheduleEstimate, type ScheduleMatchInput } from "@/lib/tournament/schedule";

/**
 * 9:00 AM on whichever calendar day `now` falls on — a reasonable default
 * for "when does today's play start." There's no per-tournament setting for
 * this yet, so it's a fixed assumption rather than something configurable.
 */
function defaultDayStart(now: Date): Date {
  const dayStart = new Date(now);
  dayStart.setUTCHours(9, 0, 0, 0);
  return dayStart;
}

/**
 * Runs the greedy schedule estimator (lib/tournament/schedule.ts) against a
 * tournament's current state. There's nothing to cache or invalidate — call
 * this fresh wherever an estimate is shown (a page render, or right after a
 * match starts or ends), and it reflects whatever's true at that moment.
 *
 * `now` is the server's own clock, not a device physically at the venue —
 * unlike startedAt/actualEnd (always submitted by the organizer's or
 * referee's device), there's no visiting player's device to source a
 * venue-local time from here. This is a display-only estimate, so a modest
 * venue/server clock skew is an accepted limitation, not a correctness issue
 * for anything actually recorded.
 */
export async function estimateTournamentSchedule(
  tournamentId: string,
  now: Date = new Date(),
): Promise<Map<string, ScheduleEstimate>> {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { courtCount: true },
  });
  if (!tournament) return new Map();

  const matches = await prisma.match.findMany({
    where: { event: { tournamentId, drawPublished: true } },
    select: {
      id: true,
      eventId: true,
      event: { select: { drawFormat: true } },
      round: true,
      position: true,
      poolId: true,
      isBye: true,
      status: true,
      startedAt: true,
      actualEnd: true,
      entry1: { select: { players: { select: { userId: true } } } },
      entry2: { select: { players: { select: { userId: true } } } },
    },
  });
  if (matches.length === 0) return new Map();

  // Feeder lookup: a bracket match (poolId null) at round R (R >= 2),
  // position P is fed by the same event's round R-1, positions 2P and 2P+1.
  // Pool and round-robin matches (and every round 1) never have one.
  const byEventRoundPosition = new Map<string, string>();
  for (const m of matches) {
    if (m.poolId === null) byEventRoundPosition.set(`${m.eventId}:${m.round}:${m.position}`, m.id);
  }

  const playerKeysFor = (entry: { players: { userId: string | null }[] } | null): readonly string[] | null =>
    entry ? entry.players.map((p) => p.userId).filter((id): id is string => id !== null) : null;

  const inputs: ScheduleMatchInput[] = matches.map((m) => ({
    matchId: m.id,
    eventId: m.eventId,
    drawFormat: m.event.drawFormat,
    round: m.round,
    position: m.position,
    feederMatchIds:
      m.poolId === null && m.round >= 2
        ? ([
            byEventRoundPosition.get(`${m.eventId}:${m.round - 1}:${m.position * 2}`) ?? "",
            byEventRoundPosition.get(`${m.eventId}:${m.round - 1}:${m.position * 2 + 1}`) ?? "",
          ] as const)
        : null,
    isBye: m.isBye,
    status: m.status,
    entry1PlayerKeys: playerKeysFor(m.entry1),
    entry2PlayerKeys: playerKeysFor(m.entry2),
    actualStart: m.startedAt,
    actualEnd: m.actualEnd,
  }));

  const estimates = estimateMatchSchedule(
    inputs,
    { courts: tournament.courtCount, dayStart: defaultDayStart(now) },
    now,
  );
  return new Map(estimates.map((e) => [e.matchId, e]));
}
