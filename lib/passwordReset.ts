import crypto from "node:crypto";

/** How long a reset link stays valid after being requested. */
export const PASSWORD_RESET_TOKEN_TTL_MINUTES = 60;

/** A cryptographically random, URL-safe raw token for the emailed reset link — see hashResetToken for why it's never stored as-is. */
export function generateResetToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/** One-way hash of a raw reset token, for safe storage — a leaked database row alone can't be used to reset a password, only a leaked email. */
export function hashResetToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}
