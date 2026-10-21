"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { generateResetToken, hashResetToken, PASSWORD_RESET_TOKEN_TTL_MINUTES } from "@/lib/passwordReset";
import { sendPasswordResetEmail } from "@/lib/email";
import { requestOrigin } from "@/lib/requestOrigin";

export type RequestResetActionState = { submitted?: boolean; error?: string };

const emailSchema = z.object({ email: z.email("Enter a valid email address") });

/**
 * Always reports success, whether or not that email is registered — telling
 * the requester which is true would let anyone check who has an account
 * here. Only an email/password account (one with a passwordHash) actually
 * gets a token; a Google-only account has no password to reset.
 */
export async function requestPasswordReset(
  _prevState: RequestResetActionState,
  formData: FormData,
): Promise<RequestResetActionState> {
  const parsed = emailSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (user?.passwordHash) {
    const rawToken = generateResetToken();
    // Superseded by this new request — an old link some stale tab still has open shouldn't keep working.
    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashResetToken(rawToken),
        expiresAt: new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MINUTES * 60_000),
      },
    });

    const origin = await requestOrigin();
    await sendPasswordResetEmail(user.email, `${origin}/reset-password?token=${rawToken}`);
  }

  return { submitted: true };
}

export type ResetPasswordActionState = { error?: string; success?: boolean };

const resetSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters").max(72),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match.",
    path: ["confirmPassword"],
  });

/** Consumes a reset link (see requestPasswordReset) and sets a new password. */
export async function resetPassword(
  token: string,
  _prevState: ResetPasswordActionState,
  formData: FormData,
): Promise<ResetPasswordActionState> {
  const parsed = resetSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashResetToken(token) } });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return { error: "This reset link is invalid or has expired. Request a new one." };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    // Every outstanding link for this user is spent by a successful reset, not just the one just used.
    prisma.passwordResetToken.updateMany({
      where: { userId: record.userId, usedAt: null },
      data: { usedAt: new Date() },
    }),
  ]);

  return { success: true };
}
