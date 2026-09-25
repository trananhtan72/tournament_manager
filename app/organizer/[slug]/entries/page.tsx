import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireOrganizerId } from "@/lib/organizerAccess";

// "Manage entries" opens on the first event's tab.
export default async function EntriesIndexPage({
  params,
}: PageProps<"/organizer/[slug]/entries">) {
  const { slug } = await params;
  const userId = await requireOrganizerId();

  const first = await prisma.event.findFirst({
    where: { tournament: { slug, organizerId: userId } },
    orderBy: { name: "asc" },
    select: { id: true },
  });
  if (first) redirect(`/organizer/${slug}/entries/${first.id}`);
  return null;
}
