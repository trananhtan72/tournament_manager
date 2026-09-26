import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/**
 * The signed-in administrator's id, for an admin-only page. A signed-out
 * visitor is sent to sign in; anyone signed in who isn't ADMIN gets a 404,
 * the same way an organizer page hides a tournament that isn't theirs.
 */
export async function requireAdminId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true },
  });
  if (!user || user.role !== "ADMIN") notFound();

  return user.id;
}
