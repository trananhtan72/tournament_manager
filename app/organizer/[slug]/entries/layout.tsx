import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireOrganizerId } from "@/lib/organizerAccess";
import { TabNav } from "@/components/TabNav";

export default async function EntriesLayout({
  children,
  params,
}: LayoutProps<"/organizer/[slug]/entries">) {
  const { slug } = await params;
  const userId = await requireOrganizerId();

  // Scoped to the signed-in organizer, so someone else's events never render here.
  const events = await prisma.event.findMany({
    where: { tournament: { slug, organizerId: userId } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, entries: { select: { status: true } } },
  });

  if (events.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        There are no events yet.{" "}
        <Link href={`/organizer/${slug}/events`} className="underline">
          Add an event
        </Link>{" "}
        to start managing entries.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <TabNav
        variant="pills"
        ariaLabel="Events"
        tabs={events.map((event) => ({
          label: event.name,
          href: `/organizer/${slug}/entries/${event.id}`,
          badge: event.entries.filter((e) => e.status === "PENDING_APPROVAL").length,
        }))}
      />
      {children}
    </div>
  );
}
