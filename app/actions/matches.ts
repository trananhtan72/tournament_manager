"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { validateCompletedMatch, type GameScore } from "@/lib/tournament/scoring";
import { gameFormatForMatch } from "@/lib/tournament/gameFormat";
import { recomputeAdvancement } from "@/lib/tournament/singleElimination";

export type MatchActionState = { error?: string };

function parseGameScore(formData: FormData, gameNumber: number): GameScore | null {
  const e1 = formData.get(`game${gameNumber}Entry1`);
  const e2 = formData.get(`game${gameNumber}Entry2`);
  if (typeof e1 !== "string" || typeof e2 !== "string" || e1.trim() === "" || e2.trim() === "") {
    return null;
  }
  const entry1Score = Number(e1);
  const entry2Score = Number(e2);
  if (!Number.isFinite(entry1Score) || !Number.isFinite(entry2Score)) return null;
  return { entry1Score, entry2Score };
}

export async function submitMatchResult(
  matchId: string,
  _prevState: MatchActionState,
  formData: FormData,
): Promise<MatchActionState> {
  const userId = await requireUserId();

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { event: { include: { tournament: true } } },
  });
  if (!match || match.event.tournament.organizerId !== userId) {
    return { error: "Match not found." };
  }
  if (!match.event.drawPublished) {
    return { error: "Publish the draw before entering scores." };
  }
  if (match.isBye || !match.entry1Id || !match.entry2Id) {
    return { error: "This match doesn't have two entries to score yet." };
  }

  const status = formData.get("status");
  if (status !== "COMPLETED" && status !== "WALKOVER" && status !== "RETIRED") {
    return { error: "Select a result type." };
  }

  let winnerId: string;
  let games: GameScore[] = [];

  if (status === "COMPLETED") {
    // The rules depend on the match: pools+knockout scores its two stages
    // under separate game formats.
    const format = gameFormatForMatch(match.event, match);
    const parsedGames = Array.from({ length: format.gamesPerMatch }, (_, i) => parseGameScore(formData, i + 1));
    const validation = validateCompletedMatch(parsedGames, format);
    if (!validation.valid) return { error: validation.error };
    winnerId = validation.winnerSide === 1 ? match.entry1Id : match.entry2Id;
    games = parsedGames.filter((g): g is GameScore => g !== null);
  } else {
    const winnerEntryId = formData.get("winnerEntryId");
    if (winnerEntryId !== match.entry1Id && winnerEntryId !== match.entry2Id) {
      return { error: "Select which entry won." };
    }
    winnerId = winnerEntryId;
  }

  const txOps = [
    prisma.matchGame.deleteMany({ where: { matchId: match.id } }),
    ...(games.length > 0
      ? [
          prisma.matchGame.createMany({
            data: games.map((g, i) => ({ matchId: match.id, gameNumber: i + 1, ...g })),
          }),
        ]
      : []),
    prisma.match.update({ where: { id: match.id }, data: { winnerId, status } }),
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
      const changed =
        original.entry1Id !== updated.entry1Id ||
        original.entry2Id !== updated.entry2Id ||
        original.winnerId !== updated.winnerId;
      if (!changed) continue;

      const clearingResult = updated.winnerId === null && original.winnerId !== null;
      txOps.push(
        prisma.match.update({
          where: { id: original.id },
          data: {
            entry1Id: updated.entry1Id,
            entry2Id: updated.entry2Id,
            winnerId: updated.winnerId,
            ...(clearingResult ? { status: null } : {}),
          },
        }),
      );
      if (clearingResult) {
        txOps.push(prisma.matchGame.deleteMany({ where: { matchId: original.id } }));
      }
    }
  }

  await prisma.$transaction(txOps);

  revalidatePath(`/organizer/${match.event.tournament.slug}/${match.eventId}`);
  revalidatePath(`/t/${match.event.tournament.slug}/${match.eventId}`);
  return {};
}
