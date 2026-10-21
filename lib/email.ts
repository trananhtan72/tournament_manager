import { Resend } from "resend";
import { env } from "@/lib/env";

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

function passwordResetEmailHtml(resetUrl: string): string {
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #1b1b23;">
      <h2 style="margin-bottom: 8px;">Reset your password</h2>
      <p>Someone asked to reset the password for this account. If that was you, choose a new one here:</p>
      <p>
        <a href="${resetUrl}" style="display: inline-block; padding: 10px 20px; background: #e14b27; color: #fff; border-radius: 6px; text-decoration: none; font-weight: 600;">
          Reset password
        </a>
      </p>
      <p style="color: #63636d; font-size: 14px;">
        This link expires in an hour. If you didn't request this, you can safely ignore this email — your password won't change.
      </p>
    </div>
  `;
}

/**
 * Sends the password-reset email — or, when RESEND_API_KEY isn't set yet,
 * logs the link to the server console instead, so the reset flow is still
 * fully testable before a real email provider is configured.
 */
export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  if (!resend) {
    console.log(`[email] RESEND_API_KEY not set — password reset link for ${to}: ${resetUrl}`);
    return;
  }

  await resend.emails.send({
    from: env.RESEND_FROM_EMAIL ?? "Tournament Manager <onboarding@resend.dev>",
    to,
    subject: "Reset your password",
    html: passwordResetEmailHtml(resetUrl),
  });
}
