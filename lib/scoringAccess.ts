export type ScoringRole = "organizer" | "referee";

/**
 * How a signed-in user relates to scoring a match: the tournament's organizer
 * can always score it; its assigned referee can too; anyone else can't.
 */
export function scoringRole(
  userId: string,
  match: { organizerId: string; refereeUserId: string | null },
): ScoringRole | null {
  if (match.organizerId === userId) return "organizer";
  if (match.refereeUserId !== null && match.refereeUserId === userId) return "referee";
  return null;
}

/**
 * Whether `role` may record a result on a match. A referee enters the result
 * of the match they're officiating; once one is saved only the organizer can
 * change it.
 */
export function mayRecordResult(role: ScoringRole, matchHasResult: boolean): boolean {
  return role === "organizer" || !matchHasResult;
}

/** A player can't officiate their own match. */
export function isPlayerInMatch(userId: string, playerUserIds: (string | null)[]): boolean {
  return playerUserIds.includes(userId);
}
