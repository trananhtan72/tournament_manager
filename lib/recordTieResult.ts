import { prisma } from "@/lib/prisma";
import { computeTieWinner, recomputeTieAdvancement, type RubberResult, type TieAdvancementSlot } from "@/lib/tournament/ties";

/**
 * Recomputes one tie's winner from its rubbers' results and, for a knockout
 * team event, cascades that winner into the next round's Tie slot — mirrors
 * recordMatchResult's bracket cascade, but for Tie rows instead of Match
 * rows (a Tie is never scored directly; its outcome aggregates its rubbers).
 * Safe to call after every rubber result: a no-op once nothing changed.
 */
export async function recomputeTieResult(tieId: string): Promise<void> {
  const tie = await prisma.tie.findUnique({
    where: { id: tieId },
    include: {
      event: { select: { drawFormat: true, tieFormatSlots: { select: { id: true } } } },
      matches: { select: { entry1Id: true, entry2Id: true, winnerId: true } },
    },
  });
  if (!tie) return;

  const slotCount = tie.event.tieFormatSlots.length;
  const rubbers: RubberResult[] = tie.matches.map((m) => ({
    winnerSide: m.winnerId === null ? null : m.winnerId === m.entry1Id ? 1 : 2,
  }));
  const winnerSide = computeTieWinner(slotCount, rubbers);
  const winnerId = winnerSide === 1 ? tie.team1Id : winnerSide === 2 ? tie.team2Id : null;
  if (winnerId === tie.winnerId) return;

  if (tie.event.drawFormat !== "SINGLE_ELIMINATION") {
    await prisma.tie.update({ where: { id: tieId }, data: { winnerId } });
    return;
  }

  const allTies = await prisma.tie.findMany({
    where: { eventId: tie.eventId },
    select: { id: true, round: true, position: true, team1Id: true, team2Id: true, winnerId: true },
  });
  const slots: TieAdvancementSlot[] = allTies.map(({ round, position, team1Id, team2Id, winnerId }) => ({
    round,
    position,
    team1Id,
    team2Id,
    winnerId,
  }));
  const recomputed = recomputeTieAdvancement(slots, tie.round, tie.position, winnerId);
  const idFor = (round: number, position: number) => allTies.find((t) => t.round === round && t.position === position)?.id;

  await prisma.$transaction(async (tx) => {
    for (const updated of recomputed) {
      const id = idFor(updated.round, updated.position);
      if (!id) continue;
      const original = allTies.find((t) => t.round === updated.round && t.position === updated.position)!;
      const entriesChanged = original.team1Id !== updated.team1Id || original.team2Id !== updated.team2Id;
      const changed = entriesChanged || original.winnerId !== updated.winnerId;
      if (!changed) continue;

      // A downstream tie whose teams just changed can't keep whatever
      // lineups/rubbers were (prematurely) submitted for the old pairing —
      // they'd be scored under the wrong teams.
      if (entriesChanged) {
        const staleMatches = await tx.match.findMany({
          where: { tieId: id },
          select: { entry1Id: true, entry2Id: true },
        });
        const staleEntryIds = staleMatches
          .flatMap((m) => [m.entry1Id, m.entry2Id])
          .filter((id): id is string => id !== null);
        await tx.match.deleteMany({ where: { tieId: id } });
        if (staleEntryIds.length > 0) {
          await tx.entry.deleteMany({ where: { id: { in: staleEntryIds } } });
        }
      }

      await tx.tie.update({
        where: { id },
        data: { team1Id: updated.team1Id, team2Id: updated.team2Id, winnerId: updated.winnerId },
      });
    }
  });
}
