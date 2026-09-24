import { shuffle } from "./shuffle";

export const MIN_POOL_SIZE = 3;
export const MAX_POOL_SIZE = 5;

/** Smallest number of pools that lets every pool land within 3-5 entries. */
export function choosePoolCount(entryCount: number): number {
  for (let pools = 1; pools <= entryCount; pools++) {
    const base = Math.floor(entryCount / pools);
    const remainder = entryCount % pools;
    const minSize = base;
    const maxSize = remainder > 0 ? base + 1 : base;
    if (minSize >= MIN_POOL_SIZE && maxSize <= MAX_POOL_SIZE) {
      return pools;
    }
  }
  throw new Error(`Can't split ${entryCount} entries into pools of ${MIN_POOL_SIZE}-${MAX_POOL_SIZE}.`);
}

export function poolName(index: number): string {
  return `Pool ${String.fromCharCode(65 + index)}`;
}

export type SeededEntryForPools = { entryId: string; seed: number | null };

/**
 * Snake-seeds entries into pools: seeded entries first (in seed order),
 * then unseeded entries in random order, dealt out 0,1,...,P-1,P-1,...,1,0,
 * 0,1,... so pool strength stays balanced instead of stacking early seeds
 * into the first few pools.
 */
export function assignEntriesToPools(
  entries: SeededEntryForPools[],
  poolCount: number,
  rand: () => number = Math.random,
): string[][] {
  const seeded = entries.filter((e) => e.seed !== null).sort((a, b) => a.seed! - b.seed!);
  const unseeded = shuffle(
    entries.filter((e) => e.seed === null),
    rand,
  );
  const ordered = [...seeded, ...unseeded];

  const pools: string[][] = Array.from({ length: poolCount }, () => []);
  let poolIndex = 0;
  let direction = 1;
  for (const entry of ordered) {
    pools[poolIndex].push(entry.entryId);
    if (poolCount === 1) continue;
    poolIndex += direction;
    if (poolIndex === poolCount) {
      poolIndex = poolCount - 1;
      direction = -1;
    } else if (poolIndex < 0) {
      poolIndex = 0;
      direction = 1;
    }
  }
  return pools;
}

export type KnockoutAdvancer = { entryId: string; seed: number };

/**
 * Seeds the knockout bracket from pool standings: every pool's 1st-place
 * finisher first (in pool order), then every 2nd-place finisher, and so on
 * — so pool winners land as the top seeds, keeping them apart for as long
 * as possible in the bracket (reuses the existing single-elimination
 * seed-placement algorithm, which already spreads seeds 1-8 correctly).
 */
export function selectKnockoutAdvancers(
  poolStandings: string[][],
  advancesPerPool: 1 | 2,
): KnockoutAdvancer[] {
  const result: KnockoutAdvancer[] = [];
  let seed = 1;
  for (let rankIndex = 0; rankIndex < advancesPerPool; rankIndex++) {
    for (const pool of poolStandings) {
      const entryId = pool[rankIndex];
      if (entryId) result.push({ entryId, seed: seed++ });
    }
  }
  return result;
}
