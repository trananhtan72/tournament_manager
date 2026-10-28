import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireOrganizerId } from "@/lib/organizerAccess";

// "Teams" opens on the first team event's tab.
export default async function TeamsIndexPage({
  params,
}: PageProps<"/organizer/[slug]/teams">) {
  const { slug } = await params;
  const userId = await requireOrganizerId();

  const first = await prisma.event.findFirst({
    where: { tournament: { slug, organizerId: userId }, category: "TEAM" },
    orderBy: { name: "asc" },
    select: { id: true },
  });
  if (first) redirect(`/organizer/${slug}/teams/${first.id}`);
  return null;
}
