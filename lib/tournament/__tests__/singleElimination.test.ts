import { describe, it, expect } from "vitest";
import {
  generateSingleEliminationBracket,
  buildSeedTemplate,
  nextPowerOfTwo,
  roundName,
  type SeededEntry,
  type BracketMatch,
} from "../singleElimination";

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

function makeEntries(count: number, seeds: Record<number, number> = {}): SeededEntry[] {
  return Array.from({ length: count }, (_, i) => ({
    entryId: `e${i}`,
    seed: seeds[i] ?? null,
  }));
}

function round1Of(matches: BracketMatch[]) {
  return matches.filter((m) => m.round === 1).sort((a, b) => a.position - b.position);
}

function findRound1Position(matches: BracketMatch[], entryId: string): number {
  const match = round1Of(matches).find(
    (m) => m.entry1Id === entryId || m.entry2Id === entryId,
  );
  if (!match) throw new Error(`entry ${entryId} not found in round 1`);
  return match.position;
}

describe("nextPowerOfTwo", () => {
  it("returns the smallest power of two >= n", () => {
    expect(nextPowerOfTwo(1)).toBe(1);
    expect(nextPowerOfTwo(4)).toBe(4);
    expect(nextPowerOfTwo(5)).toBe(8);
    expect(nextPowerOfTwo(8)).toBe(8);
    expect(nextPowerOfTwo(9)).toBe(16);
    expect(nextPowerOfTwo(64)).toBe(64);
  });
});

describe("buildSeedTemplate", () => {
  it("matches the known standard template for size 4", () => {
    expect(buildSeedTemplate(4)).toEqual([1, 4, 3, 2]);
  });

  it("matches the known standard template for size 8", () => {
    expect(buildSeedTemplate(8)).toEqual([1, 8, 4, 5, 6, 3, 7, 2]);
  });

  it("places every rank exactly once", () => {
    const template = buildSeedTemplate(16);
    expect(new Set(template).size).toBe(16);
    expect([...template].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 16 }, (_, i) => i + 1),
    );
  });

  it("places seed 1 at the first slot and seed 2 at the last slot", () => {
    for (const size of [2, 4, 8, 16, 32, 64]) {
      const template = buildSeedTemplate(size);
      expect(template[0]).toBe(1);
      expect(template[size - 1]).toBe(2);
    }
  });
});

describe("roundName", () => {
  it("labels the last three rounds correctly", () => {
    expect(roundName(4, 4)).toBe("Final");
    expect(roundName(3, 4)).toBe("Semifinals");
    expect(roundName(2, 4)).toBe("Quarterfinals");
  });

  it("labels earlier rounds by player count", () => {
    expect(roundName(1, 4)).toBe("Round of 16");
    expect(roundName(1, 5)).toBe("Round of 32");
    expect(roundName(1, 6)).toBe("Round of 64");
  });
});

describe("generateSingleEliminationBracket validation", () => {
  it("rejects fewer than 4 entries", () => {
    expect(() => generateSingleEliminationBracket(makeEntries(3))).toThrow();
  });

  it("rejects more than 64 entries", () => {
    expect(() => generateSingleEliminationBracket(makeEntries(65))).toThrow();
  });

  it("accepts the boundary sizes 4 and 64", () => {
    expect(() => generateSingleEliminationBracket(makeEntries(4))).not.toThrow();
    expect(() => generateSingleEliminationBracket(makeEntries(64))).not.toThrow();
  });
});

describe("generateSingleEliminationBracket with a full power-of-two bracket", () => {
  const rand = mulberry32(42);
  const entries = makeEntries(8, { 0: 1, 1: 2, 2: 3, 3: 4 });
  const matches = generateSingleEliminationBracket(entries, rand);

  it("creates no byes", () => {
    expect(round1Of(matches).every((m) => !m.isBye)).toBe(true);
  });

  it("fills every round-1 slot with a real entry", () => {
    for (const m of round1Of(matches)) {
      expect(m.entry1Id).not.toBeNull();
      expect(m.entry2Id).not.toBeNull();
    }
  });

  it("creates the correct number of matches per round", () => {
    expect(matches.filter((m) => m.round === 1)).toHaveLength(4);
    expect(matches.filter((m) => m.round === 2)).toHaveLength(2);
    expect(matches.filter((m) => m.round === 3)).toHaveLength(1);
  });

  it("leaves later rounds empty (TBD)", () => {
    for (const m of matches.filter((m) => m.round > 1)) {
      expect(m.entry1Id).toBeNull();
      expect(m.entry2Id).toBeNull();
      expect(m.winnerId).toBeNull();
    }
  });

  it("includes every entry exactly once across round 1", () => {
    const seen = round1Of(matches).flatMap((m) => [m.entry1Id, m.entry2Id]).filter(Boolean);
    expect(seen.sort()).toEqual(entries.map((e) => e.entryId).sort());
  });

  it("has unique (round, position) pairs", () => {
    const keys = matches.map((m) => `${m.round}:${m.position}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("generateSingleEliminationBracket seeding placement", () => {
  it("keeps seed 1 and seed 2 in opposite halves across many trials", () => {
    for (let trial = 0; trial < 25; trial++) {
      const rand = mulberry32(trial);
      const entries = makeEntries(8, { 0: 1, 1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 7, 7: 8 });
      const matches = generateSingleEliminationBracket(entries, rand);
      const numRound1Matches = 4;
      const halfSize = numRound1Matches / 2;
      const pos1 = findRound1Position(matches, "e0"); // seed 1
      const pos2 = findRound1Position(matches, "e1"); // seed 2
      expect(Math.floor(pos1 / halfSize)).not.toBe(Math.floor(pos2 / halfSize));
    }
  });

  it("keeps seeds 1-4 in four different quarters across many trials", () => {
    for (let trial = 0; trial < 25; trial++) {
      const rand = mulberry32(trial * 7 + 1);
      const entries = makeEntries(16, { 0: 1, 1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 7, 7: 8 });
      const matches = generateSingleEliminationBracket(entries, rand);
      const numRound1Matches = 8;
      const quarterSize = numRound1Matches / 4;
      const quarters = ["e0", "e1", "e2", "e3"].map(
        (id) => Math.floor(findRound1Position(matches, id) / quarterSize),
      );
      expect(new Set(quarters).size).toBe(4);
    }
  });

  it("places seed 2 in the very last round-1 slot across many trials", () => {
    for (let trial = 0; trial < 25; trial++) {
      const rand = mulberry32(trial * 3 + 5);
      const entries = makeEntries(8, { 0: 1, 1: 2, 2: 3, 3: 4 });
      const matches = generateSingleEliminationBracket(entries, rand);
      const round1 = round1Of(matches);
      const lastMatch = round1[round1.length - 1];
      expect(lastMatch.entry2Id).toBe("e1");
    }
  });

  it("keeps seeds 1-8 in eight different eighths across many trials", () => {
    for (let trial = 0; trial < 25; trial++) {
      const rand = mulberry32(trial * 13 + 3);
      const entries = makeEntries(16, { 0: 1, 1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 7, 7: 8 });
      const matches = generateSingleEliminationBracket(entries, rand);
      const eighths = Array.from({ length: 8 }, (_, i) =>
        findRound1Position(matches, `e${i}`),
      );
      expect(new Set(eighths).size).toBe(8);
    }
  });
});

describe("generateSingleEliminationBracket byes", () => {
  it("gives byes to the top seeds first when entries aren't a power of two", () => {
    // 5 entries, bracket size 8, 3 byes needed. Seeds 1-3 assigned; seed 4 is unseeded (index 4).
    const entries = makeEntries(5, { 0: 1, 1: 2, 2: 3 });
    const matches = generateSingleEliminationBracket(entries, mulberry32(1));
    const round1 = round1Of(matches);
    expect(round1.filter((m) => m.isBye)).toHaveLength(3);

    for (const seededId of ["e0", "e1", "e2"]) {
      const match = round1.find((m) => m.entry1Id === seededId || m.entry2Id === seededId)!;
      expect(match.isBye).toBe(true);
      expect(match.winnerId).toBe(seededId);
    }
  });

  it("produces exactly bracketSize/2 - byeCount real matches and byeCount byes", () => {
    const entries = makeEntries(11); // bracket size 16, 5 byes
    const matches = generateSingleEliminationBracket(entries, mulberry32(2));
    const round1 = round1Of(matches);
    expect(round1).toHaveLength(8);
    expect(round1.filter((m) => m.isBye)).toHaveLength(5);
    expect(round1.filter((m) => !m.isBye)).toHaveLength(3);
  });

  it("advances bye winners directly into their round-2 slot", () => {
    const entries = makeEntries(5, { 0: 1 });
    const matches = generateSingleEliminationBracket(entries, mulberry32(4));
    const round1 = round1Of(matches);
    const byeMatch = round1.find((m) => m.entry1Id === "e0")!;
    expect(byeMatch.isBye).toBe(true);

    const round2Position = Math.floor(byeMatch.position / 2);
    const round2Match = matches.find((m) => m.round === 2 && m.position === round2Position)!;
    const advancedSlot =
      byeMatch.position % 2 === 0 ? round2Match.entry1Id : round2Match.entry2Id;
    expect(advancedSlot).toBe("e0");
  });

  it("never gives a bye to two entries that would face an empty match", () => {
    for (let trial = 0; trial < 20; trial++) {
      const entries = makeEntries(13, { 0: 1, 1: 2, 2: 3 }); // bracket 16, 3 byes
      const matches = generateSingleEliminationBracket(entries, mulberry32(trial + 100));
      for (const m of round1Of(matches)) {
        if (m.isBye) {
          expect(m.entry1Id).not.toBeNull();
          expect(m.entry2Id).toBeNull();
        } else {
          expect(m.entry1Id).not.toBeNull();
          expect(m.entry2Id).not.toBeNull();
        }
      }
    }
  });
});

describe("generateSingleEliminationBracket with a partially-filled seed tier", () => {
  it("still gives all three seeds a bye when only seed 3 (not 4) exists, across many trials", () => {
    // Regression test: seed 3's tier-mate (rank 4) is unassigned, so which of
    // ranks 3/4 seed 3 lands on is randomized — that must not affect whether
    // seed 3 (a top-priority entry) actually gets its bye.
    for (let trial = 0; trial < 50; trial++) {
      const entries = makeEntries(5, { 0: 1, 1: 2, 2: 3 }); // no seed 4
      const matches = generateSingleEliminationBracket(entries, mulberry32(trial + 500));
      const round1 = round1Of(matches);
      expect(round1.filter((m) => m.isBye)).toHaveLength(3);
      for (const seededId of ["e0", "e1", "e2"]) {
        const match = round1.find((m) => m.entry1Id === seededId || m.entry2Id === seededId)!;
        expect(match.isBye).toBe(true);
        expect(match.winnerId).toBe(seededId);
      }
    }
  });

  it("gives all four seeds byes when only seeds 1, 2 and 4 exist (not 3), across many trials", () => {
    for (let trial = 0; trial < 50; trial++) {
      const entries = makeEntries(6, { 0: 1, 1: 2, 2: 4 }); // bracket 8, seed 3 missing, byesNeeded=2
      const matches = generateSingleEliminationBracket(entries, mulberry32(trial + 900));
      const round1 = round1Of(matches);
      expect(round1.filter((m) => m.isBye)).toHaveLength(2);
      for (const seededId of ["e0", "e1"]) {
        const match = round1.find((m) => m.entry1Id === seededId || m.entry2Id === seededId)!;
        expect(match.isBye).toBe(true);
      }
    }
  });
});

describe("generateSingleEliminationBracket when byes exceed the seeded count", () => {
  it("gives every seed a bye and spreads remaining byes among unseeded entries", () => {
    for (let trial = 0; trial < 30; trial++) {
      // bracket size 16, 9 entries -> 7 byes needed, only 2 seeds assigned.
      const entries = makeEntries(9, { 0: 1, 1: 2 });
      const matches = generateSingleEliminationBracket(entries, mulberry32(trial + 1300));
      const round1 = round1Of(matches);
      expect(round1.filter((m) => m.isBye)).toHaveLength(7);
      for (const seededId of ["e0", "e1"]) {
        const match = round1.find((m) => m.entry1Id === seededId || m.entry2Id === seededId)!;
        expect(match.isBye).toBe(true);
      }
      // Every entry still appears exactly once.
      const placed = round1.flatMap((m) => [m.entry1Id, m.entry2Id]).filter(Boolean);
      expect(placed.sort()).toEqual(entries.map((e) => e.entryId).sort());
    }
  });
});

describe("generateSingleEliminationBracket with no seeds at all", () => {
  it("still produces a valid bracket with every entry placed once", () => {
    const entries = makeEntries(6); // bracket size 8, 2 byes
    const matches = generateSingleEliminationBracket(entries, mulberry32(9));
    const round1 = round1Of(matches);
    const placed = round1.flatMap((m) => [m.entry1Id, m.entry2Id]).filter(Boolean);
    expect(placed.sort()).toEqual(entries.map((e) => e.entryId).sort());
    expect(round1.filter((m) => m.isBye)).toHaveLength(2);
  });
});
