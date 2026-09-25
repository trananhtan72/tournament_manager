/** How long a finished match's final score stays on a court's screen. */
export const RECENT_FINAL_MS = 10 * 60 * 1000;

type CourtMatch = {
  status: unknown;
  liveStartedAt: Date | null;
  scheduledAt: Date | null;
  updatedAt: Date;
  round: number;
  position: number;
};

export type CourtDisplayChoice<T> =
  | { kind: "live"; match: T }
  | { kind: "final"; match: T }
  | { kind: "next"; match: T }
  | { kind: "idle" };

/**
 * What a court's screen should show, given every match assigned to that court:
 * the match being scored live; else the result of one that just finished
 * (so players can see the final score); else the next scheduled match; else
 * nothing.
 */
export function pickCourtDisplay<T extends CourtMatch>(matches: T[], now: Date): CourtDisplayChoice<T> {
  const live = matches
    .filter((m) => m.status === null && m.liveStartedAt !== null)
    .sort((a, b) => b.liveStartedAt!.getTime() - a.liveStartedAt!.getTime());
  if (live.length > 0) return { kind: "live", match: live[0] };

  const justFinished = matches
    .filter((m) => m.status !== null && now.getTime() - m.updatedAt.getTime() <= RECENT_FINAL_MS)
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  if (justFinished.length > 0) return { kind: "final", match: justFinished[0] };

  const upcoming = matches
    .filter((m) => m.status === null && m.scheduledAt !== null)
    .sort((a, b) => a.scheduledAt!.getTime() - b.scheduledAt!.getTime() || a.round - b.round || a.position - b.position);
  if (upcoming.length > 0) return { kind: "next", match: upcoming[0] };

  return { kind: "idle" };
}
