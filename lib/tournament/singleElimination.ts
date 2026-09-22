export type SeededEntry = {
  entryId: string;
  seed: number | null;
};

export type BracketMatch = {
  round: number;
  position: number;
  entry1Id: string | null;
  entry2Id: string | null;
  winnerId: string | null;
  isBye: boolean;
};

export const MIN_BRACKET_ENTRIES = 4;
export const MAX_BRACKET_ENTRIES = 64;

/** Seeds above this are drawn randomly like any unseeded entry (spec caps organizer-assigned seeds at 8). */
const MAX_ASSIGNABLE_SEED = 8;
const SEED_TIERS: number[][] = [[1], [2], [3, 4], [5, 6, 7, 8]];

export function nextPowerOfTwo(n: number): number {
  let size = 1;
  while (size < n) size *= 2;
  return size;
}

function shuffle<T>(items: T[], rand: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function buildRawSeedTemplate(bracketSize: number): number[] {
  if (bracketSize === 1) return [1];
  const half = buildRawSeedTemplate(bracketSize / 2);
  const result: number[] = [];
  for (const seed of half) {
    result.push(seed);
    result.push(bracketSize + 1 - seed);
  }
  return result;
}

/**
 * Standard seeded-bracket slot template: template[slot] = the seed rank that
 * "belongs" at that slot in an ideal, fully-seeded bracket of this size.
 * Guarantees seed 1 and 2 fall in opposite halves, 1-4 in different
 * quarters, 1-8 in different eighths, and so on recursively — with seed 1
 * pinned to the very first slot and seed 2 to the very last slot, matching
 * the usual top-to-bottom bracket convention.
 *
 * Built by reversing the second half of the raw recursive template: that
 * half already contains exactly the complementary seeds (opposite halves,
 * quarters, eighths, ...) as the first half, so reordering it as a block
 * only relocates seed 2 to the far end without disturbing any of those
 * separation guarantees.
 */
export function buildSeedTemplate(bracketSize: number): number[] {
  const raw = buildRawSeedTemplate(bracketSize);
  if (bracketSize === 1) return raw;
  const half = bracketSize / 2;
  return [...raw.slice(0, half), ...raw.slice(half).reverse()];
}

/**
 * Builds a single-elimination bracket for the given entries: seeds 1/2 in
 * opposite halves, 3/4 randomly drawn into the remaining quarters (and so on
 * for 5-8 into eighths), unseeded entries placed randomly, and byes given to
 * the top of the seed/priority order when the entry count isn't a power of
 * two. Returns round-1 matches (played or byes) plus empty TBD matches for
 * every later round; bye winners are already advanced into round 2.
 *
 * Pure and deterministic given `rand` — no I/O, no DB access.
 */
export function generateSingleEliminationBracket(
  entries: SeededEntry[],
  rand: () => number = Math.random,
): BracketMatch[] {
  const n = entries.length;
  if (n < MIN_BRACKET_ENTRIES || n > MAX_BRACKET_ENTRIES) {
    throw new Error(
      `Single elimination requires between ${MIN_BRACKET_ENTRIES} and ${MAX_BRACKET_ENTRIES} entries (got ${n}).`,
    );
  }

  const bracketSize = nextPowerOfTwo(n);
  const numRounds = Math.log2(bracketSize);
  const byesNeeded = bracketSize - n;

  const seeded = entries
    .filter((e) => e.seed != null && e.seed <= MAX_ASSIGNABLE_SEED)
    .sort((a, b) => (a.seed as number) - (b.seed as number));
  const unseeded = shuffle(
    entries.filter((e) => !seeded.includes(e)),
    rand,
  );

  // Who gets a bye is decided purely by priority (seeds first in seed order,
  // then unseeded in random order) — independent of any slot placement, so
  // it can't be skewed by which of two symmetric tier slots a seed lands on.
  const priorityOrder = [...seeded, ...unseeded];
  const byeRecipients = new Set(priorityOrder.slice(0, byesNeeded).map((e) => e.entryId));

  const template = buildSeedTemplate(bracketSize);
  const rankToSlot = new Map<number, number>();
  template.forEach((rank, slot) => rankToSlot.set(rank, slot));

  const rankOfEntry = new Map<string, number>();
  const usedRanks = new Set<number>();
  for (const tierRanks of SEED_TIERS) {
    const seedsInTier = seeded.filter((e) => tierRanks.includes(e.seed as number));
    if (seedsInTier.length === 0) continue;
    const shuffledTierRanks = shuffle(tierRanks, rand);
    seedsInTier.forEach((entry, i) => {
      const rank = shuffledTierRanks[i];
      rankOfEntry.set(entry.entryId, rank);
      usedRanks.add(rank);
    });
  }

  const slots: (string | null)[] = new Array(bracketSize).fill(null);
  for (const [entryId, rank] of rankOfEntry) {
    slots[rankToSlot.get(rank)!] = entryId;
  }

  // Fill every remaining rank-pair (r, bracketSize+1-r). One side may
  // already hold a seeded entry; the other is open. A pair with a seeded
  // bye-recipient is left with its open side empty; every other pair is
  // filled with unseeded entries — byes preferred first (so unseeded byes,
  // which only arise when byesNeeded exceeds the seeded count, land here
  // too), otherwise a real match between two unseeded entries.
  const unseededQueue = [...unseeded];
  const takeNextBye = (): SeededEntry | null => {
    const idx = unseededQueue.findIndex((e) => byeRecipients.has(e.entryId));
    return idx === -1 ? null : unseededQueue.splice(idx, 1)[0];
  };
  const takeNextPlaying = (): SeededEntry | null => {
    const idx = unseededQueue.findIndex((e) => !byeRecipients.has(e.entryId));
    return idx === -1 ? null : unseededQueue.splice(idx, 1)[0];
  };

  for (let rank = 1; rank <= bracketSize / 2; rank++) {
    const pairRank = bracketSize + 1 - rank;
    if (usedRanks.has(rank) && usedRanks.has(pairRank)) continue; // both seeded already

    const seededSide = usedRanks.has(rank) ? rank : usedRanks.has(pairRank) ? pairRank : null;
    if (seededSide !== null) {
      const openSide = seededSide === rank ? pairRank : rank;
      const seededEntryId = slots[rankToSlot.get(seededSide)!]!;
      if (!byeRecipients.has(seededEntryId)) {
        // This seed plays for real — its opponent must be a playing entry,
        // never a bye-recipient (that would wrongly spend their bye here).
        const opponent = takeNextPlaying();
        if (opponent) slots[rankToSlot.get(openSide)!] = opponent.entryId;
      }
      // else: seeded bye recipient — leave the open side empty.
      continue;
    }

    // Neither side is seeded: both open. Place a bye here if any unseeded
    // byes remain (leaving the pair's other side empty); otherwise a real
    // match between two playing entries.
    const byeEntry = takeNextBye();
    if (byeEntry) {
      slots[rankToSlot.get(rank)!] = byeEntry.entryId;
      continue;
    }
    const first = takeNextPlaying();
    if (!first) continue;
    slots[rankToSlot.get(rank)!] = first.entryId;
    const second = takeNextPlaying();
    if (second) slots[rankToSlot.get(pairRank)!] = second.entryId;
  }

  const matches: BracketMatch[] = [];

  for (let m = 0; m < bracketSize / 2; m++) {
    const a = slots[2 * m];
    const b = slots[2 * m + 1];
    if (a !== null && b !== null) {
      matches.push({ round: 1, position: m, entry1Id: a, entry2Id: b, winnerId: null, isBye: false });
    } else {
      const present = a ?? b;
      matches.push({
        round: 1,
        position: m,
        entry1Id: present,
        entry2Id: null,
        winnerId: present,
        isBye: true,
      });
    }
  }

  for (let round = 2; round <= numRounds; round++) {
    const matchesInRound = bracketSize / Math.pow(2, round);
    for (let position = 0; position < matchesInRound; position++) {
      matches.push({ round, position, entry1Id: null, entry2Id: null, winnerId: null, isBye: false });
    }
  }

  if (numRounds >= 2) {
    for (const match of matches) {
      if (match.round !== 1 || !match.isBye) continue;
      const nextMatch = matches.find(
        (m) => m.round === 2 && m.position === Math.floor(match.position / 2),
      );
      if (!nextMatch) continue;
      if (match.position % 2 === 0) nextMatch.entry1Id = match.winnerId;
      else nextMatch.entry2Id = match.winnerId;
    }
  }

  return matches;
}

export function roundName(round: number, totalRounds: number): string {
  const fromEnd = totalRounds - round;
  if (fromEnd === 0) return "Final";
  if (fromEnd === 1) return "Semifinals";
  if (fromEnd === 2) return "Quarterfinals";
  const playersInRound = Math.pow(2, fromEnd + 1);
  return `Round of ${playersInRound}`;
}
