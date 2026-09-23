import type { DrawFormat, EventCategory, MatchStatus } from "@prisma/client";

export const drawFormatLabels: Record<DrawFormat, string> = {
  SINGLE_ELIMINATION: "Single elimination",
  ROUND_ROBIN: "Round robin",
  POOLS_KNOCKOUT: "Pools + knockout",
};

export const matchStatusLabels: Record<MatchStatus, string> = {
  COMPLETED: "Completed",
  WALKOVER: "Walkover",
  RETIRED: "Retired",
};

export const categoryLabels: Record<EventCategory, string> = {
  SINGLES: "Singles",
  DOUBLES: "Doubles",
};

export function isDoublesCategory(category: EventCategory): boolean {
  return category === "DOUBLES";
}

// Standard event presets from the spec. Organizers can also pick "Other" to
// name and categorize an event themselves (age divisions, senior events, etc).
export const EVENT_NAME_PRESETS: { name: string; category: EventCategory }[] = [
  { name: "Men's Singles", category: "SINGLES" },
  { name: "Women's Singles", category: "SINGLES" },
  { name: "Men's Doubles", category: "DOUBLES" },
  { name: "Women's Doubles", category: "DOUBLES" },
  { name: "Mixed Doubles", category: "DOUBLES" },
];

export const OTHER_EVENT_NAME = "__OTHER__";
