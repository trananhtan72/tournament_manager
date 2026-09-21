import { prisma } from "@/lib/prisma";

export async function notify(userId: string, message: string, link?: string): Promise<void> {
  await prisma.notification.create({ data: { userId, message, link } });
}
