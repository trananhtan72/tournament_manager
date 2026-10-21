import { z } from "zod";

// An unset Google client id/secret still reaches here as "" from an empty
// .env placeholder line, not undefined — treat that the same as unset rather
// than failing validation on it.
const optionalEnvString = z.preprocess((v) => (v === "" ? undefined : v), z.string().min(1).optional());

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  AUTH_SECRET: z.string().min(1, "AUTH_SECRET is required"),
  // Optional: "Sign in with Google" is only offered when both are set (see
  // auth.ts), so environments without a Google OAuth client configured yet
  // still run fine on Credentials alone.
  AUTH_GOOGLE_ID: optionalEnvString,
  AUTH_GOOGLE_SECRET: optionalEnvString,
  // Optional: without it, lib/email.ts logs the password-reset link to the
  // server console instead of emailing it — the reset flow itself still
  // works end to end, just without real delivery, until this is set.
  RESEND_API_KEY: optionalEnvString,
  // "Name <email@domain>" or a bare address. Defaults to Resend's shared
  // onboarding@resend.dev sender, which works without verifying a domain but
  // can only send to the email the Resend account itself was signed up
  // with — fine for development, not for real users.
  RESEND_FROM_EMAIL: optionalEnvString,
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(
    `Invalid environment variables: ${JSON.stringify(z.treeifyError(parsed.error))}`,
  );
}

export const env = parsed.data;
