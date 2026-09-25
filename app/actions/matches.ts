"use server";

import { revalidateTournament } from "@/lib/revalidate";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { recordMatchResult } from "@/lib/recordMatchResult";
import { validateCompletedMatch, type GameScore } from "@/lib/tournament/scoring";
import { gameFormatForMatch } from "@/lib/tournament/gameFormat";
import { parseDateTimeLocal } from "@/lib/tournament/schedule";
import { mayRecordResult, scoringRole } from "@/lib/scoringAccess";

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
    include: { event: { include: { tournament: true } }, referee: { select: { userId: true } } },
  });
  const role = match
    ? scoringRole(userId, {
        organizerId: match.event.tournament.organizerId,
        refereeUserId: match.referee?.userId ?? null,
      })
    : null;
  if (!match || !role) {
    return { error: "Match not found." };
  }
  if (!mayRecordResult(role, match.status !== null)) {
    return { error: "This match already has a result — ask the organizer if it needs changing." };
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

  // Every played match records when it began. A walkover was never played.
  let startedAt: Date | null = null;
  if (status !== "WALKOVER") {
    const rawStart = String(formData.get("startedAt") ?? "").trim();
    if (!rawStart) return { error: "Enter when the match started." };
    startedAt = parseDateTimeLocal(rawStart);
    if (!startedAt) return { error: "Enter a valid start time." };
  }

  await recordMatchResult(match, { status, winnerId, games, startedAt });

  revalidateTournament(match.event.tournament.slug);
  return {};
}
