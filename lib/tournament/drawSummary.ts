import type { DrawFormat } from "@prisma/client";
import { roundName } from "./singleElimination";

export type DrawSummaryMatch = {
  poolId: string | null;
  round: number;
  isBye: boolean;
  winnerId: string | null;
  entry1Id: string | null;
  entry2Id: string | null;
};

/** How many entries the draw was made for: those placed in its first stage. */
export function drawSize(drawFormat: DrawFormat, matches: DrawSummaryMatch[]): number {
  const firstStage = matches.filter((m) => {
    if (drawFormat === "SINGLE_ELIMINATION") return m.round === 1;
    if (drawFormat === "POOLS_KNOCKOUT") return m.poolId !== null;
    return true;
  });
  const entryIds = new Set<string>();
  for (const m of firstStage) {
    if (m.entry1Id) entryIds.add(m.entry1Id);
    if (m.entry2Id) entryIds.add(m.entry2Id);
  }
  return entryIds.size;
}

// Where a knockout bracket currently is: the earliest round that still has an
// unplayed match, or "Completed" once the final has a winner.
function knockoutStage(matches: DrawSummaryMatch[]): string {
  const totalRounds = matches.reduce((max, m) => Math.max(max, m.round), 0);
  const unfinished = matches.filter((m) => !m.isBye && m.winnerId === null);
  if (unfinished.length === 0) return "Completed";
  const currentRound = Math.min(...unfinished.map((m) => m.round));
  return roundName(currentRound, totalRounds);
}

/** "Round of 16", "Semifinals", "Pool stage", "Completed"… — what the draw is up to. */
export function drawStage(drawFormat: DrawFormat, matches: DrawSummaryMatch[]): string {
  if (matches.length === 0) return "Not drawn yet";

  if (drawFormat === "SINGLE_ELIMINATION") return knockoutStage(matches);

  if (drawFormat === "ROUND_ROBIN") {
    return matches.every((m) => m.winnerId !== null) ? "Completed" : "Round robin";
  }

  const poolMatches = matches.filter((m) => m.poolId !== null);
  const knockoutMatches = matches.filter((m) => m.poolId === null);
  if (poolMatches.some((m) => m.winnerId === null)) return "Pool stage";
  if (knockoutMatches.length === 0) return "Pool stage complete";
  const stage = knockoutStage(knockoutMatches);
  return stage === "Completed" ? stage : `Knockout — ${stage}`;
}
