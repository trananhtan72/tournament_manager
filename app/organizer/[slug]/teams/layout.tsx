import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireOrganizerId } from "@/lib/organizerAccess";
import { TabNav } from "@/components/TabNav";

export default async function TeamsLayout({
  children,
  params,
}: LayoutProps<"/organizer/[slug]/teams">) {
  const { slug } = await params;
  const userId = await requireOrganizerId();

  // Scoped to the signed-in organizer, so someone else's events never render here.
  const teamEvents = await prisma.event.findMany({
    where: { tournament: { slug, organizerId: userId }, category: "TEAM" },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  if (teamEvents.length === 0) {
    return (
      <p className="text-sm text-muted">
        There are no team events yet.{" "}
        <Link href={`/organizer/${slug}/events`} className="underline">
          Add a team event
        </Link>{" "}
        to start managing teams.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <TabNav
        variant="pills"
        ariaLabel="Team events"
        tabs={teamEvents.map((event) => ({
          label: event.name,
          href: `/organizer/${slug}/teams/${event.id}`,
        }))}
      />
      {children}
    </div>
  );
}
