export const DEFAULT_COURT_COUNT = 12;
export const MIN_COURTS = 1;
export const MAX_COURTS = 50;

/** Courts are named "Court 1" … "Court N". */
export function courtName(courtNumber: number): string {
  return `Court ${courtNumber}`;
}

/** 3 for "Court 3" (any case or spacing); null for anything else, such as a free-text court name. */
export function parseCourtNumber(court: string | null | undefined): number | null {
  const match = /^court\s*(\d{1,3})$/i.exec((court ?? "").trim());
  if (!match) return null;
  const courtNumber = Number(match[1]);
  return courtNumber >= 1 ? courtNumber : null;
}

export function courtNumbers(courtCount: number): number[] {
  return Array.from({ length: courtCount }, (_, i) => i + 1);
}

/** A court number from a form value ("3"), if it's a whole number within 1..courtCount. */
export function toCourtNumber(value: unknown, courtCount: number): number | null {
  const courtNumber = typeof value === "number" ? value : typeof value === "string" && /^\d{1,3}$/.test(value.trim()) ? Number(value) : NaN;
  return Number.isInteger(courtNumber) && courtNumber >= 1 && courtNumber <= courtCount ? courtNumber : null;
}
