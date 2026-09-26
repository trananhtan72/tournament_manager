import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { SimpleTable } from "@/components/SimpleTable";
import { tournamentTabMetadata } from "@/lib/tournamentMetadata";

export function generateMetadata({ params }: PageProps<"/t/[slug]/events">): Promise<Metadata> {
  return tournamentTabMetadata(params, "Events");
}

export default async function EventsTab({ params }: PageProps<"/t/[slug]/events">) {
  const { slug } = await params;

  const tournament = await prisma.tournament.findUnique({
    where: { slug },
    include: {
      events: {
        orderBy: { name: "asc" },
        include: { _count: { select: { entries: { where: { status: "CONFIRMED" } } } } },
      },
    },
  });
  if (!tournament) notFound();

  if (tournament.events.length === 0) {
    return <p className="text-sm text-muted">No events have been added yet.</p>;
  }

  return (
    <SimpleTable
      columns={[{ label: "Name" }, { label: "Draws", align: "right" }, { label: "Entries", align: "right" }]}
      rows={tournament.events.map((event) => ({
        key: event.id,
        cells: [
          <Link key="name" href={`/t/${slug}/${event.id}`} className="font-medium underline">
            {event.name}
          </Link>,
          // Each event has one draw, which players can only see once it's published.
          event.drawPublished ? 1 : 0,
          event._count.entries,
        ],
      }))}
    />
  );
}
