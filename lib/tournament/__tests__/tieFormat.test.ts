import { describe, it, expect } from "vitest";
import {
  STANDARD_FIVE_MATCH_TIE,
  MIN_TIE_SLOTS,
  MAX_TIE_SLOTS,
  validateTieFormatSlots,
  rubbersNeededToWinTie,
  type TieFormatSlotInput,
} from "../tieFormat";

describe("STANDARD_FIVE_MATCH_TIE", () => {
  it("is 5 slots: 2 doubles and 3 singles, in Thomas/Uber Cup order", () => {
    expect(STANDARD_FIVE_MATCH_TIE).toHaveLength(5);
    expect(STANDARD_FIVE_MATCH_TIE.map((s) => s.type)).toEqual([
      "DOUBLES",
      "SINGLES",
      "DOUBLES",
      "SINGLES",
      "SINGLES",
    ]);
    expect(validateTieFormatSlots(STANDARD_FIVE_MATCH_TIE)).toEqual({ valid: true });
  });
});

function slot(order: number, overrides: Partial<TieFormatSlotInput> = {}): TieFormatSlotInput {
  return { order, label: `Slot ${order}`, type: "SINGLES", gamesPerMatch: 3, pointsPerGame: 21, ...overrides };
}

describe("validateTieFormatSlots", () => {
  it("accepts a minimal 1-slot tie and a custom-length tie within bounds", () => {
    expect(validateTieFormatSlots([slot(1)])).toEqual({ valid: true });
    const slots = Array.from({ length: 7 }, (_, i) => slot(i + 1));
    expect(validateTieFormatSlots(slots)).toEqual({ valid: true });
  });

  it("rejects too few or too many slots", () => {
    expect(validateTieFormatSlots([]).valid).toBe(false);
    const tooMany = Array.from({ length: MAX_TIE_SLOTS + 1 }, (_, i) => slot(i + 1));
    expect(validateTieFormatSlots(tooMany).valid).toBe(false);
    expect(MIN_TIE_SLOTS).toBe(1);
  });

  it("rejects out-of-order, gapped, or repeated order values", () => {
    expect(validateTieFormatSlots([slot(1), slot(3)]).valid).toBe(false);
    expect(validateTieFormatSlots([slot(2), slot(1)])).toEqual({ valid: true }); // order of the array doesn't matter
    expect(validateTieFormatSlots([slot(1), slot(1)]).valid).toBe(false);
  });

  it("rejects a blank label", () => {
    expect(validateTieFormatSlots([slot(1, { label: "  " })]).valid).toBe(false);
  });

  it("rejects an invalid game format on any slot", () => {
    expect(validateTieFormatSlots([slot(1, { gamesPerMatch: 2 })]).valid).toBe(false);
    expect(validateTieFormatSlots([slot(1), slot(2, { pointsPerGame: 4 })]).valid).toBe(false);
  });

  it("allows slots to mix formats (e.g. shorter doubles games)", () => {
    const slots = [
      slot(1, { type: "DOUBLES", gamesPerMatch: 1, pointsPerGame: 21 }),
      slot(2, { type: "SINGLES", gamesPerMatch: 3, pointsPerGame: 21 }),
    ];
    expect(validateTieFormatSlots(slots)).toEqual({ valid: true });
  });
});

describe("rubbersNeededToWinTie", () => {
  it("is a strict majority for an odd slot count", () => {
    expect(rubbersNeededToWinTie(1)).toBe(1);
    expect(rubbersNeededToWinTie(3)).toBe(2);
    expect(rubbersNeededToWinTie(5)).toBe(3);
  });

  it("is more than half for an even slot count — an exact split never reaches it", () => {
    expect(rubbersNeededToWinTie(4)).toBe(3);
    expect(rubbersNeededToWinTie(2)).toBe(2);
  });
});
