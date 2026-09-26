import type { UserRole } from "@prisma/client";

/**
 * The tournament-manager administrator's account. Whoever signs up (or
 * already has an account) with this email is always ADMIN — see the signUp
 * action for new accounts and this feature's migration for a backfill of an
 * existing one. Compared case-insensitively since sign-up doesn't normalize
 * email case.
 */
export const ADMIN_EMAIL = "tea@gmail.com";

export function isAdminEmail(email: string): boolean {
  return email.trim().toLowerCase() === ADMIN_EMAIL;
}

/** ADMIN and ORGANIZER accounts can create tournaments; a plain USER can't. */
export function canCreateTournaments(role: UserRole): boolean {
  return role === "ADMIN" || role === "ORGANIZER";
}

export const NOT_AUTHORIZED_TO_CREATE_TOURNAMENT =
  "Only approved organizers can create tournaments. Ask the tournament-manager administrator for access.";
