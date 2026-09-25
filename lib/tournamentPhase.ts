export type TournamentPhase = "upcoming" | "ongoing" | "past";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Dates are stored as UTC midnight of the calendar day, so the end date only
 * finishes at the *end* of that day — a tournament is still ongoing on its
 * last day.
 */
export function tournamentPhase(startDate: Date, endDate: Date, now: Date = new Date()): TournamentPhase {
  if (now.getTime() < startDate.getTime()) return "upcoming";
  if (now.getTime() < endDate.getTime() + DAY_MS) return "ongoing";
  return "past";
}
