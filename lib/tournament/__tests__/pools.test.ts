import { describe, it, expect } from "vitest";
import {
  choosePoolCount,
  poolName,
  assignEntriesToPools,
  selectKnockoutAdvancers,
  MIN_POOL_SIZE,
  MAX_POOL_SIZE,
  type SeededEntryForPools,
} from "../pools";

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("choosePoolCount", () => {
  it("keeps every pool within 3-5 entries, preferring fewer/larger pools", () => {
    for (let n = 3; n <= 40; n++) {
      const pools = choosePoolCount(n);
      const base = Math.floor(n / pools);
      const remainder = n % pools;
      const minSize = base;
      const maxSize = remainder > 0 ? base + 1 : base;
      expect(minSize).toBeGreaterThanOrEqual(MIN_POOL_SIZE);
      expect(maxSize).toBeLessThanOrEqual(MAX_POOL_SIZE);
    }
  });

  it("throws for fewer than 3 entries", () => {
    expect(() => choosePoolCount(2)).toThrow();
    expect(() => choosePoolCount(0)).toThrow();
  });

  it("picks exact known values", () => {
    expect(choosePoolCount(3)).toBe(1);
    expect(choosePoolCount(5)).toBe(1);
    expect(choosePoolCount(6)).toBe(2); // not 1 pool of 6 (exceeds max 5)
    expect(choosePoolCount(9)).toBe(2); // 5+4
    expect(choosePoolCount(10)).toBe(2); // 5+5
  });
});

describe("poolName", () => {
  it("names pools alphabetically", () => {
    expect(poolName(0)).toBe("Pool A");
    expect(poolName(1)).toBe("Pool B");
    expect(poolName(25)).toBe("Pool Z");
  });
});

describe("assignEntriesToPools", () => {
  it("places every entry into exactly one pool", () => {
    const entries: SeededEntryForPools[] = Array.from({ length: 10 }, (_, i) => ({
      entryId: `e${i}`,
      seed: null,
    }));
    const pools = assignEntriesToPools(entries, 2, mulberry32(1));
    const allPlaced = pools.flat();
    expect(allPlaced.sort()).toEqual(entries.map((e) => e.entryId).sort());
  });

  it("snake-seeds top seeds into different pools", () => {
    const entries: SeededEntryForPools[] = [
      { entryId: "seed1", seed: 1 },
      { entryId: "seed2", seed: 2 },
      { entryId: "seed3", seed: 3 },
      { entryId: "seed4", seed: 4 },
      ...Array.from({ length: 8 }, (_, i) => ({ entryId: `u${i}`, seed: null })),
    ];
    const pools = assignEntriesToPools(entries, 4, mulberry32(2));
    // Snake order for 4 pools: seed1->pool0, seed2->pool1, seed3->pool2,
    // seed4->pool3 (first pass, left to right).
    expect(pools[0]).toContain("seed1");
    expect(pools[1]).toContain("seed2");
    expect(pools[2]).toContain("seed3");
    expect(pools[3]).toContain("seed4");
    // No two top-4 seeds share a pool.
    for (const pool of pools) {
      const topSeedsInPool = pool.filter((id) => ["seed1", "seed2", "seed3", "seed4"].includes(id));
      expect(topSeedsInPool.length).toBeLessThanOrEqual(1);
    }
  });

  it("distributes pool sizes evenly (snake pattern balances counts)", () => {
    const entries: SeededEntryForPools[] = Array.from({ length: 11 }, (_, i) => ({
      entryId: `e${i}`,
      seed: null,
    }));
    const pools = assignEntriesToPools(entries, 3, mulberry32(3));
    const sizes = pools.map((p) => p.length).sort();
    expect(sizes).toEqual([3, 4, 4]);
  });
});

describe("selectKnockoutAdvancers", () => {
  it("seeds pool winners ahead of runners-up, in pool order", () => {
    const standings = [
      ["poolA-1st", "poolA-2nd", "poolA-3rd"],
      ["poolB-1st", "poolB-2nd", "poolB-3rd"],
    ];
    const advancers = selectKnockoutAdvancers(standings, 2);
    expect(advancers).toEqual([
      { entryId: "poolA-1st", seed: 1 },
      { entryId: "poolB-1st", seed: 2 },
      { entryId: "poolA-2nd", seed: 3 },
      { entryId: "poolB-2nd", seed: 4 },
    ]);
  });

  it("takes only the pool winner when advancesPerPool is 1", () => {
    const standings = [
      ["poolA-1st", "poolA-2nd"],
      ["poolB-1st", "poolB-2nd"],
      ["poolC-1st", "poolC-2nd"],
    ];
    const advancers = selectKnockoutAdvancers(standings, 1);
    expect(advancers.map((a) => a.entryId)).toEqual(["poolA-1st", "poolB-1st", "poolC-1st"]);
  });

  it("skips a pool that's short an entry at that rank", () => {
    const standings = [["a1", "a2", "a3"], ["b1"]];
    const advancers = selectKnockoutAdvancers(standings, 2);
    expect(advancers.map((a) => a.entryId)).toEqual(["a1", "b1", "a2"]);
  });
});
