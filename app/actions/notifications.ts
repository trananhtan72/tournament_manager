"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";

export async function markAllNotificationsRead(): Promise<void> {
  const userId = await requireUserId();

  await prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });

  revalidatePath("/notifications");
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const userId = await requireUserId();

  await prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { read: true },
  });

  revalidatePath("/notifications");
}
