import { prisma } from "@/lib/prisma";
import type { GameFormat } from "@/lib/tournament/gameFormat";
import { replayPoints, type LiveState, type Side } from "@/lib/tournament/liveScoring";

type LiveCandidate = {
  id: string;
  liveStartedAt: Date | null;
  firstServer: number | null;
  status: unknown;
};

/** A match is live from the moment scoring starts until its result is confirmed. */
export function isLiveMatch(match: { liveStartedAt: Date | null; status: unknown }): boolean {
  return match.liveStartedAt !== null && match.status === null;
}

/**
 * The current state of every live match in `matches`, replayed from their
 * point logs in one query. Matches that aren't live are simply absent.
 */
export async function loadLiveStates<T extends LiveCandidate>(
  matches: T[],
  formatFor: (match: T) => GameFormat,
): Promise<Map<string, LiveState>> {
  const live = matches.filter(isLiveMatch);
  if (live.length === 0) return new Map();

  const rows = await prisma.matchPoint.findMany({
    where: { matchId: { in: live.map((m) => m.id) } },
    orderBy: [{ matchId: "asc" }, { seq: "asc" }],
    select: { matchId: true, side: true },
  });
  const sidesByMatch = new Map<string, Side[]>();
  for (const row of rows) {
    sidesByMatch.set(row.matchId, [...(sidesByMatch.get(row.matchId) ?? []), row.side as Side]);
  }

  return new Map(
    live.map((match) => [
      match.id,
      replayPoints(sidesByMatch.get(match.id) ?? [], formatFor(match), (match.firstServer ?? 1) as Side),
    ]),
  );
}
