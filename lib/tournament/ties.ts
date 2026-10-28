import {
  generateSingleEliminationBracket,
  recomputeAdvancement,
  type SeededEntry,
  type AdvancementMatch,
} from "./singleElimination";
import { generateRoundRobinMatches } from "./roundRobin";
import { rubbersNeededToWinTie } from "./tieFormat";

/**
 * The team-bracket shape `Tie` rows use (`team1Id`/`team2Id`, not
 * `entry1Id`/`entry2Id`) — otherwise identical to `BracketMatch`. Teams are
 * themselves shim `Entry` rows, so the existing bracket/round-robin
 * generators are reused unchanged; these are thin renames around them.
 */
export type TieSlot = {
  round: number;
  position: number;
  team1Id: string | null;
  team2Id: string | null;
  winnerId: string | null;
  isBye: boolean;
};

export type RoundRobinTieSlot = {
  position: number;
  team1Id: string;
  team2Id: string;
};

/** Seeds a knockout bracket of teams, one `Tie` per bracket slot. */
export function generateKnockoutTies(
  teams: SeededEntry[],
  rand: () => number = Math.random,
  deterministicSeeding = false,
): TieSlot[] {
  return generateSingleEliminationBracket(teams, rand, deterministicSeeding).map((m) => ({
    round: m.round,
    position: m.position,
    team1Id: m.entry1Id,
    team2Id: m.entry2Id,
    winnerId: m.winnerId,
    isBye: m.isBye,
  }));
}

/** Every team plays every other team once, one `Tie` per pairing. */
export function generateRoundRobinTies(teamIds: string[]): RoundRobinTieSlot[] {
  return generateRoundRobinMatches(teamIds).map((m) => ({
    position: m.position,
    team1Id: m.entry1Id,
    team2Id: m.entry2Id,
  }));
}

export type TieAdvancementSlot = {
  round: number;
  position: number;
  team1Id: string | null;
  team2Id: string | null;
  winnerId: string | null;
};

/** `recomputeAdvancement`, renamed to and from the `Tie` field names. */
export function recomputeTieAdvancement<T extends TieAdvancementSlot>(
  ties: T[],
  changedRound: number,
  changedPosition: number,
  newWinnerId: string | null,
): TieAdvancementSlot[] {
  const asMatches: AdvancementMatch[] = ties.map((t) => ({
    round: t.round,
    position: t.position,
    entry1Id: t.team1Id,
    entry2Id: t.team2Id,
    winnerId: t.winnerId,
  }));
  return recomputeAdvancement(asMatches, changedRound, changedPosition, newWinnerId).map((m) => ({
    round: m.round,
    position: m.position,
    team1Id: m.entry1Id,
    team2Id: m.entry2Id,
    winnerId: m.winnerId,
  }));
}

export type RubberResult = {
  /** Which side of the tie won this rubber, or null if it isn't decided yet. */
  winnerSide: 1 | 2 | null;
};

/**
 * The tie's winning side once a majority of its rubbers are decided, or null
 * while it's still undecided. Rubbers keep being played out even after the
 * tie is clinched (no early-stop in v1), so this is safe to recompute after
 * every individual rubber result — it only ever moves from null to a side,
 * never flips once set, as long as rubber results themselves aren't edited
 * after the fact.
 */
export function computeTieWinner(slotCount: number, rubbers: RubberResult[]): 1 | 2 | null {
  const needed = rubbersNeededToWinTie(slotCount);
  let wins1 = 0;
  let wins2 = 0;
  for (const rubber of rubbers) {
    if (rubber.winnerSide === 1) wins1++;
    else if (rubber.winnerSide === 2) wins2++;
  }
  if (wins1 >= needed) return 1;
  if (wins2 >= needed) return 2;
  return null;
}
