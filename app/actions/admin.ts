"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminId } from "@/lib/adminAccess";
import { isAdminEmail } from "@/lib/roles";
import { notify } from "@/lib/notify";
import { organizerGrantedMessage, organizerRevokedMessage } from "@/lib/adminMessages";

export type AdminActionState = { error?: string; saved?: boolean };

/** Grants an existing account the ability to create tournaments. */
export async function grantOrganizerAccess(
  _prevState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireAdminId();

  const parsed = z.email("Enter a valid email address").safeParse(String(formData.get("email") ?? "").trim());
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Enter a valid email address" };

  const user = await prisma.user.findFirst({ where: { email: { equals: parsed.data, mode: "insensitive" } } });
  if (!user) {
    return { error: "No account found with that email. They need to sign up first, then you can grant them access." };
  }
  if (user.role !== "USER") {
    return {
      error:
        user.role === "ADMIN"
          ? `${user.name} is already an administrator.`
          : `${user.name} can already create tournaments.`,
    };
  }

  await prisma.user.update({ where: { id: user.id }, data: { role: "ORGANIZER" } });
  await notify(user.id, organizerGrantedMessage(), "/organizer");
  revalidatePath("/admin");
  return { saved: true };
}

/** Revokes tournament-creation access. Tournaments they've already created are untouched. */
export async function revokeOrganizerAccess(
  userId: string,
  _prevState: AdminActionState,
  _formData: FormData,
): Promise<AdminActionState> {
  await requireAdminId();

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { error: "Account not found." };
  if (isAdminEmail(user.email)) return { error: "The administrator account can't be revoked." };
  if (user.role !== "ORGANIZER") return { error: "That account doesn't have organizer access." };

  await prisma.user.update({ where: { id: userId }, data: { role: "USER" } });
  await notify(user.id, organizerRevokedMessage(), "/dashboard");
  revalidatePath("/admin");
  return { saved: true };
}
