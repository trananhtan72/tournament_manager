import { prisma } from "@/lib/prisma";
import { revalidateTournament } from "@/lib/revalidate";
import {
  cascadeReschedule,
  DEFAULT_MATCH_DURATION_MINUTES,
  DEFAULT_MIN_REST_MINUTES,
  type CascadeScheduledMatch,
} from "@/lib/tournament/schedule";

const playerKeysFor = (entry: { players: { userId: string | null }[] } | null): readonly string[] =>
  entry ? entry.players.map((p) => p.userId).filter((id): id is string => id !== null) : [];

/**
 * Called right after a match's result is recorded: re-anchors the rest of
 * that day's already-scheduled matches to how the match actually went,
 * rather than leaving them at whatever the schedule originally assumed. A
 * match that finished early pulls its court's queue forward; one that ran
 * long pushes it back; another still-scheduled match sharing a player is
 * pushed later if it would now start before that player has rested; and a
 * match with feeders is never left earlier than both are decided — see
 * cascadeReschedule in lib/tournament/schedule.ts for the exact rules.
 *
 * A no-op if the concluded match was never given a time — nothing depends on
 * a match that was never part of a plan. `minRestMinutes` and
 * `matchDurationMinutes` aren't persisted anywhere per schedule, so this uses
 * the same defaults the estimator falls back to; the actual numbers rarely
 * matter, since they only change anything in the edge case of a match
 * running unusually long or short.
 */
export async function cascadeRescheduleAfterMatch(matchId: string, actualEnd: Date): Promise<void> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: {
      eventId: true,
      round: true,
      position: true,
      poolId: true,
      scheduledAt: true,
      court: true,
      event: { select: { tournamentId: true, tournament: { select: { slug: true } } } },
      entry1: { select: { players: { select: { userId: true } } } },
      entry2: { select: { players: { select: { userId: true } } } },
    },
  });
  if (!match || !match.scheduledAt) return;

  const tournamentId = match.event.tournamentId;
  const concludedPlayerKeys = [...playerKeysFor(match.entry1), ...playerKeysFor(match.entry2)];

  const others = await prisma.match.findMany({
    where: {
      event: { tournamentId },
      id: { not: matchId },
      isBye: false,
      status: null,
      scheduledAt: { not: null },
    },
    select: {
      id: true,
      eventId: true,
      round: true,
      position: true,
      poolId: true,
      scheduledAt: true,
      court: true,
      entry1: { select: { players: { select: { userId: true } } } },
      entry2: { select: { players: { select: { userId: true } } } },
    },
  });
  if (others.length === 0) return;

  // Feeder lookup: a bracket match (poolId null) at round R (R >= 2),
  // position P is fed by the same event's round R-1, positions 2P and 2P+1.
  // Built from every not-yet-played match here, plus the concluded one
  // itself (a feeder frequently *is* the match that just finished) — without
  // it, a final's reference to the semifinal that just concluded would never
  // resolve, since that match isn't part of `others`.
  const byEventRoundPosition = new Map<string, string>();
  if (match.poolId === null) byEventRoundPosition.set(`${match.eventId}:${match.round}:${match.position}`, matchId);
  for (const m of others) {
    if (m.poolId === null) byEventRoundPosition.set(`${m.eventId}:${m.round}:${m.position}`, m.id);
  }

  const inputs: CascadeScheduledMatch[] = others.map((m) => ({
    matchId: m.id,
    scheduledAt: m.scheduledAt!,
    court: m.court,
    playerKeys: [...playerKeysFor(m.entry1), ...playerKeysFor(m.entry2)],
    feederMatchIds:
      m.poolId === null && m.round >= 2
        ? [
            byEventRoundPosition.get(`${m.eventId}:${m.round - 1}:${m.position * 2}`) ?? "",
            byEventRoundPosition.get(`${m.eventId}:${m.round - 1}:${m.position * 2 + 1}`) ?? "",
          ]
        : null,
  }));

  const shifts = cascadeReschedule(
    inputs,
    { matchId, scheduledAt: match.scheduledAt, court: match.court, playerKeys: concludedPlayerKeys },
    actualEnd,
    DEFAULT_MIN_REST_MINUTES,
    DEFAULT_MATCH_DURATION_MINUTES,
  );
  if (shifts.size === 0) return;

  await prisma.$transaction(
    [...shifts.entries()].map(([id, scheduledAt]) => prisma.match.update({ where: { id }, data: { scheduledAt } })),
  );

  revalidateTournament(match.event.tournament.slug);
}
