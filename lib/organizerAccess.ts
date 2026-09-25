import { redirect } from "next/navigation";
import { auth } from "@/auth";

/** The signed-in user's id for an organizer page, sending signed-out visitors to sign in. */
export async function requireOrganizerId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  return session.user.id;
}
