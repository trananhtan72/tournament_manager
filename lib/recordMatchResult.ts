import { prisma } from "@/lib/prisma";
import type { GameScore } from "@/lib/tournament/scoring";
import { recomputeAdvancement } from "@/lib/tournament/singleElimination";

export type RecordedResult = {
  status: "COMPLETED" | "WALKOVER" | "RETIRED";
  winnerId: string;
  /** Game scores, in order; empty for a walkover. */
  games: GameScore[];
  /** When the match began (venue-local wall-clock time); null for a walkover, which was never played. */
  startedAt: Date | null;
};

/**
 * Saves a match's result and advances the winner through the bracket,
 * clearing any later result that depended on a different winner. Used both
 * by manual score entry and by confirming a live-scored match, so they can't
 * disagree about what a result does.
 *
 * A manual result replaces whatever was scored live for that match; when a
 * live match is confirmed (`keepLivePoints`) its point log is kept as the
 * record of how it went.
 */
export async function recordMatchResult(
  match: {
    id: string;
    eventId: string;
    round: number;
    position: number;
    poolId: string | null;
    event: { drawFormat: "SINGLE_ELIMINATION" | "ROUND_ROBIN" | "POOLS_KNOCKOUT" };
  },
  result: RecordedResult,
  { keepLivePoints = false }: { keepLivePoints?: boolean } = {},
): Promise<void> {
  const { status, winnerId, games, startedAt } = result;

  const txOps = [
    prisma.matchGame.deleteMany({ where: { matchId: match.id } }),
    ...(games.length > 0
      ? [
          prisma.matchGame.createMany({
            data: games.map((g, i) => ({ matchId: match.id, gameNumber: i + 1, ...g })),
          }),
        ]
      : []),
    ...(keepLivePoints ? [] : [prisma.matchPoint.deleteMany({ where: { matchId: match.id } })]),
    prisma.match.update({
      where: { id: match.id },
      data: {
        winnerId,
        status,
        startedAt,
        ...(keepLivePoints ? {} : { liveStartedAt: null, firstServer: null }),
      },
    }),
  ];

  // Only a real single-elimination bracket has a "next round" to cascade
  // into — that's single elimination itself, or the knockout stage of
  // pools+knockout (poolId null there; pool-stage matches always have one,
  // and round robin never has a round to advance into in the first place).
  const isBracketMatch = match.event.drawFormat === "SINGLE_ELIMINATION" || match.poolId === null;
  if (isBracketMatch && match.event.drawFormat !== "ROUND_ROBIN") {
    const allMatches = await prisma.match.findMany({
      where: { eventId: match.eventId, poolId: null },
      select: { id: true, round: true, position: true, entry1Id: true, entry2Id: true, winnerId: true },
    });
    const recomputed = recomputeAdvancement(allMatches, match.round, match.position, winnerId);

    for (const updated of recomputed) {
      if (updated.round === match.round && updated.position === match.position) continue;
      const original = allMatches.find((m) => m.round === updated.round && m.position === updated.position)!;
      const entriesChanged = original.entry1Id !== updated.entry1Id || original.entry2Id !== updated.entry2Id;
      const changed = entriesChanged || original.winnerId !== updated.winnerId;
      if (!changed) continue;

      const clearingResult = updated.winnerId === null && original.winnerId !== null;
      // Live scoring belongs to a specific pairing: if the pairing changed
      // (or the result is being cleared), what was scored live no longer applies.
      const resetLive = clearingResult || entriesChanged;
      txOps.push(
        prisma.match.update({
          where: { id: original.id },
          data: {
            entry1Id: updated.entry1Id,
            entry2Id: updated.entry2Id,
            winnerId: updated.winnerId,
            ...(clearingResult ? { status: null, startedAt: null } : {}),
            ...(resetLive ? { liveStartedAt: null, firstServer: null } : {}),
          },
        }),
      );
      if (clearingResult) {
        txOps.push(prisma.matchGame.deleteMany({ where: { matchId: original.id } }));
      }
      if (resetLive) {
        txOps.push(prisma.matchPoint.deleteMany({ where: { matchId: original.id } }));
      }
    }
  }

  await prisma.$transaction(txOps);
}
