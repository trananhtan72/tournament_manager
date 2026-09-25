import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireOrganizerId } from "@/lib/organizerAccess";
import { drawFormatLabels } from "@/lib/eventLabels";
import { drawSize, drawStage } from "@/lib/tournament/drawSummary";
import { SimpleTable } from "@/components/SimpleTable";
import { EventDrawManager, drawEventInclude } from "@/app/organizer/[slug]/draws/EventDrawManager";

export const metadata: Metadata = { title: "Draws" };

export default async function OrganizerDrawsPage({
  params,
}: PageProps<"/organizer/[slug]/draws">) {
  const { slug } = await params;
  const userId = await requireOrganizerId();

  const tournament = await prisma.tournament.findFirst({
    where: { slug, organizerId: userId },
    include: { events: { orderBy: { name: "asc" }, include: drawEventInclude } },
  });
  if (!tournament) notFound();

  if (tournament.events.length === 0) {
    return <p className="text-sm text-slate-500">There are no events yet, so there are no draws.</p>;
  }

  return (
    <div className="flex flex-col gap-8">
      <SimpleTable
        columns={[
          { label: "Draw" },
          { label: "Size", align: "right" },
          { label: "Type" },
          { label: "Stage" },
          { label: "Status" },
        ]}
        rows={tournament.events.map((event) => {
          const drawn = event.matches.length > 0;
          return {
            key: event.id,
            cells: [
              <a key="draw" href={`#draw-${event.id}`} className="font-medium underline">
                {event.name}
              </a>,
              drawn ? drawSize(event.drawFormat, event.matches) : event.entries.length,
              drawFormatLabels[event.drawFormat],
              drawStage(event.drawFormat, event.matches),
              event.drawPublished ? "Published" : drawn ? "Draft" : "Not drawn",
            ],
          };
        })}
      />

      {tournament.events.map((event) => (
        <EventDrawManager key={event.id} event={event} tournamentName={tournament.name} />
      ))}
    </div>
  );
}
