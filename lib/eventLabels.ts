import type { DrawFormat, EventType } from "@prisma/client";

export const eventTypeLabels: Record<EventType, string> = {
  MS: "Men's Singles",
  WS: "Women's Singles",
  MD: "Men's Doubles",
  WD: "Women's Doubles",
  XD: "Mixed Doubles",
};

export const drawFormatLabels: Record<DrawFormat, string> = {
  SINGLE_ELIMINATION: "Single elimination",
  ROUND_ROBIN: "Round robin",
  POOLS_KNOCKOUT: "Pools + knockout",
};

const DOUBLES_EVENT_TYPES = new Set<EventType>(["MD", "WD", "XD"]);

export function isDoublesEventType(type: EventType): boolean {
  return DOUBLES_EVENT_TYPES.has(type);
}
