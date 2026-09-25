"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { revalidateTournament } from "@/lib/revalidate";
import { recordMatchResult } from "@/lib/recordMatchResult";
import { gameFormatForMatch } from "@/lib/tournament/gameFormat";
import { completedGames, isSide, replayPoints, type Side } from "@/lib/tournament/liveScoring";
import { validateCompletedMatch } from "@/lib/tournament/scoring";
import { courtName, toCourtNumber } from "@/lib/tournament/courts";
import { parseDateTimeLocal } from "@/lib/tournament/schedule";
import { scoringRole } from "@/lib/scoringAccess";

/** The authoritative point log, so a client that got out of step can catch up. */
export type LivePointsResult = { points: Side[]; error?: string };
export type LiveActionState = { error?: string };

const STALE = "The score changed on another device — showing the latest.";

// Every live action needs the same things to be true of the match: the
// signed-in user is its tournament's organizer or its assigned referee, its
// draw is published, both players are known, and it doesn't have a recorded
// result yet.
async function loadScorableMatch(matchId: string) {
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
    return { error: "Match not found." } as const;
  }
  if (!match.event.drawPublished) {
    return { error: "Publish the draw before scoring matches." } as const;
  }
  if (match.isBye || !match.entry1Id || !match.entry2Id) {
    return { error: "This match doesn't have two entries to score yet." } as const;
  }
  if (match.status !== null) {
    return { error: "This match already has a result." } as const;
  }
  return { match, format: gameFormatForMatch(match.event, match) } as const;
}

async function loadSides(matchId: string): Promise<Side[]> {
  const rows = await prisma.matchPoint.findMany({
    where: { matchId },
    orderBy: { seq: "asc" },
    select: { side: true },
  });
  return rows.map((row) => row.side as Side);
}

// Two matches can't be live on one court at once (its screen shows one).
async function courtConflict(tournamentId: string, court: string, exceptMatchId: string): Promise<string | null> {
  const clash = await prisma.match.findFirst({
    where: {
      id: { not: exceptMatchId },
      status: null,
      liveStartedAt: { not: null },
      court: { equals: court, mode: "insensitive" },
      event: { tournamentId },
    },
    select: { event: { select: { name: true } } },
  });
  return clash ? `${court} already has a match being scored live (${clash.event.name}). Finish or discard it first, or pick another court.` : null;
}

export async function startLiveMatch(
  matchId: string,
  _prevState: LiveActionState,
  formData: FormData,
): Promise<LiveActionState> {
  const loaded = await loadScorableMatch(matchId);
  if ("error" in loaded) return { error: loaded.error };
  const { match } = loaded;

  const firstServer = Number(formData.get("firstServer"));
  if (!isSide(firstServer)) return { error: "Choose who serves first." };

  const courtNumber = toCourtNumber(formData.get("court"), match.event.tournament.courtCount);
  if (courtNumber === null) return { error: "Choose the court this match is being played on." };

  // The organizer's device clock is the venue's wall-clock time.
  const startedAt = parseDateTimeLocal(String(formData.get("startedAt") ?? ""));
  if (!startedAt) return { error: "Couldn't read the start time. Reload the page and try again." };

  // Starting is idempotent: a second device opening the same match just joins it.
  if (match.liveStartedAt !== null) return {};

  const court = courtName(courtNumber);
  const clash = await courtConflict(match.event.tournamentId, court, matchId);
  if (clash) return { error: clash };

  await prisma.$transaction([
    prisma.matchPoint.deleteMany({ where: { matchId } }),
    prisma.match.update({
      where: { id: matchId },
      data: { liveStartedAt: new Date(), firstServer, startedAt, court },
    }),
  ]);
  revalidateTournament(match.event.tournament.slug);
  return {};
}

/** Moves a live match to another court (e.g. it was started on the wrong one). */
export async function changeLiveCourt(matchId: string, courtNumber: number): Promise<LiveActionState> {
  const loaded = await loadScorableMatch(matchId);
  if ("error" in loaded) return { error: loaded.error };
  const { match } = loaded;

  const validNumber = toCourtNumber(courtNumber, match.event.tournament.courtCount);
  if (validNumber === null) return { error: "Choose a court from the list." };
  const court = courtName(validNumber);
  const clash = await courtConflict(match.event.tournamentId, court, matchId);
  if (clash) return { error: clash };

  await prisma.match.update({ where: { id: matchId }, data: { court } });
  revalidateTournament(match.event.tournament.slug);
  return {};
}

/**
 * Records a rally. `expectedPoints` is how many rallies the caller believes
 * have been played: if it doesn't match the log (a double-tap, or someone else
 * scoring the same match) nothing is recorded and the real log is returned.
 * No page revalidation here — this runs on every tap and viewers poll instead.
 */
export async function recordPoint(matchId: string, side: Side, expectedPoints: number): Promise<LivePointsResult> {
  const loaded = await loadScorableMatch(matchId);
  if ("error" in loaded) return { points: [], error: loaded.error };
  const { match, format } = loaded;
  if (!isSide(side)) return { points: await loadSides(matchId), error: "Choose which side won the rally." };
  if (match.liveStartedAt === null || match.firstServer === null) {
    return { points: [], error: "Start live scoring first." };
  }

  const sides = await loadSides(matchId);
  if (sides.length !== expectedPoints) return { points: sides, error: STALE };
  if (replayPoints(sides, format, match.firstServer as Side).matchWinner) {
    return { points: sides, error: "The match is already decided — confirm the result, or undo the last point." };
  }

  try {
    await prisma.matchPoint.create({ data: { matchId, seq: sides.length + 1, side } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { points: await loadSides(matchId), error: STALE };
    }
    throw error;
  }
  return { points: [...sides, side] };
}

/** The server's point log, for a scorer that lost its connection and needs to catch up. */
export async function getLivePoints(matchId: string): Promise<LivePointsResult> {
  const loaded = await loadScorableMatch(matchId);
  if ("error" in loaded) return { points: [], error: loaded.error };
  return { points: await loadSides(matchId) };
}

export async function undoPoint(matchId: string, expectedPoints: number): Promise<LivePointsResult> {
  const loaded = await loadScorableMatch(matchId);
  if ("error" in loaded) return { points: [], error: loaded.error };

  const sides = await loadSides(matchId);
  if (sides.length !== expectedPoints) return { points: sides, error: STALE };
  if (sides.length === 0) return { points: sides };

  await prisma.matchPoint.deleteMany({ where: { matchId, seq: sides.length } });
  return { points: sides.slice(0, -1) };
}

/** Saves a finished live match as its official result and advances the winner. */
export async function confirmLiveResult(
  matchId: string,
  expectedPoints: number,
  startedAtInput: string,
): Promise<LiveActionState> {
  const loaded = await loadScorableMatch(matchId);
  if ("error" in loaded) return { error: loaded.error };
  const { match, format } = loaded;
  if (match.firstServer === null) return { error: "Start live scoring first." };

  // Saved when scoring began; the organizer may have corrected it on the confirm screen.
  let startedAt = match.startedAt;
  if (startedAtInput.trim() !== "") {
    startedAt = parseDateTimeLocal(startedAtInput);
    if (!startedAt) return { error: "Enter a valid start time." };
  }
  if (!startedAt) return { error: "Enter when the match started." };

  const sides = await loadSides(matchId);
  if (sides.length !== expectedPoints) return { error: STALE };

  const state = replayPoints(sides, format, match.firstServer as Side);
  if (!state.matchWinner) return { error: "The match isn't finished yet." };

  // The point log can only produce legal games, but the same check as manual
  // entry is the last line of defence before a bracket advances.
  const games = completedGames(state);
  const validation = validateCompletedMatch(games, format);
  if (!validation.valid) return { error: validation.error };

  await recordMatchResult(
    match,
    {
      status: "COMPLETED",
      winnerId: state.matchWinner === 1 ? match.entry1Id! : match.entry2Id!,
      games,
      startedAt,
    },
    { keepLivePoints: true },
  );
  revalidateTournament(match.event.tournament.slug);
  return {};
}

/** Throws away the live score (e.g. it was started by mistake) so scoring can start over. */
export async function resetLiveMatch(matchId: string): Promise<LiveActionState> {
  const loaded = await loadScorableMatch(matchId);
  if ("error" in loaded) return { error: loaded.error };

  await prisma.$transaction([
    prisma.matchPoint.deleteMany({ where: { matchId } }),
    prisma.match.update({ where: { id: matchId }, data: { liveStartedAt: null, firstServer: null, startedAt: null } }),
  ]);
  revalidateTournament(loaded.match.event.tournament.slug);
  return {};
}
