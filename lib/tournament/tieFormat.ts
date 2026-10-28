import { isValidGameFormat, DEFAULT_GAME_FORMAT } from "./gameFormat";

export type TieSlotType = "SINGLES" | "DOUBLES";

export type TieFormatSlotInput = {
  order: number;
  label: string;
  type: TieSlotType;
  gamesPerMatch: number;
  pointsPerGame: number;
};

export const MIN_TIE_SLOTS = 1;
export const MAX_TIE_SLOTS = 15;

/** Thomas/Uber Cup order: doubles open the tie, alternating with singles. */
export const STANDARD_FIVE_MATCH_TIE: TieFormatSlotInput[] = [
  { order: 1, label: "Doubles 1", type: "DOUBLES", ...DEFAULT_GAME_FORMAT },
  { order: 2, label: "Singles 1", type: "SINGLES", ...DEFAULT_GAME_FORMAT },
  { order: 3, label: "Doubles 2", type: "DOUBLES", ...DEFAULT_GAME_FORMAT },
  { order: 4, label: "Singles 2", type: "SINGLES", ...DEFAULT_GAME_FORMAT },
  { order: 5, label: "Singles 3", type: "SINGLES", ...DEFAULT_GAME_FORMAT },
];

export type TieFormatValidation = { valid: true } | { valid: false; error: string };

/**
 * Validates an organizer's tie format, whether it's the standard preset
 * (editable) or fully custom: a sane slot count, sequential order with no
 * gaps or repeats, a label and valid type per slot, and a valid game format
 * per slot (slots may mix formats, e.g. shorter games for doubles).
 */
export function validateTieFormatSlots(slots: TieFormatSlotInput[]): TieFormatValidation {
  if (slots.length < MIN_TIE_SLOTS || slots.length > MAX_TIE_SLOTS) {
    return {
      valid: false,
      error: `A tie needs between ${MIN_TIE_SLOTS} and ${MAX_TIE_SLOTS} matches (got ${slots.length}).`,
    };
  }

  const orders = [...slots].map((s) => s.order).sort((a, b) => a - b);
  if (!orders.every((o, i) => o === i + 1)) {
    return { valid: false, error: "Slot order must be sequential starting at 1, with no gaps or repeats." };
  }

  for (const slot of slots) {
    if (!slot.label.trim()) {
      return { valid: false, error: `Slot ${slot.order} needs a label.` };
    }
    if (slot.type !== "SINGLES" && slot.type !== "DOUBLES") {
      return { valid: false, error: `Slot ${slot.order} ("${slot.label}") has an invalid type.` };
    }
    if (!isValidGameFormat({ gamesPerMatch: slot.gamesPerMatch, pointsPerGame: slot.pointsPerGame })) {
      return { valid: false, error: `Slot ${slot.order} ("${slot.label}") doesn't have a valid game format.` };
    }
  }

  return { valid: true };
}

/**
 * Majority of the tie's slots. Well-defined for an odd slot count (the usual
 * case — e.g. 3 of 5); for an even custom format, a slot-for-slot split
 * never reaches it, so the tie stays undecided — an organizer-facing
 * limitation of even formats, not a bug, and left for a future phase.
 */
export function rubbersNeededToWinTie(slotCount: number): number {
  return Math.floor(slotCount / 2) + 1;
}
