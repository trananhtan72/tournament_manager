import { env } from "@/lib/env";

/** Whether a Google OAuth client is configured — gates both the provider in auth.ts and the sign-in/up button. */
export function isGoogleAuthEnabled(): boolean {
  return Boolean(env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET);
}
