import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireOrganizerId } from "@/lib/organizerAccess";
import { drawFormatLabels } from "@/lib/eventLabels";
import { drawSize, drawStage } from "@/lib/tournament/drawSummary";
import { SimpleTable } from "@/components/SimpleTable";
import { EventDrawManager, drawEventInclude } from "@/app/organizer/[slug]/draws/EventDrawManager";
import { TeamDrawManager, teamDrawEventInclude } from "@/app/organizer/[slug]/teams/TeamDrawManager";

export const metadata: Metadata = { title: "Draws" };

export default async function OrganizerDrawsPage({
  params,
}: PageProps<"/organizer/[slug]/draws">) {
  const { slug } = await params;
  const userId = await requireOrganizerId();

  const tournament = await prisma.tournament.findFirst({
    where: { slug, organizerId: userId },
    include: { events: { orderBy: { name: "asc" }, include: { ...drawEventInclude, ...teamDrawEventInclude } } },
  });
  if (!tournament) notFound();

  if (tournament.events.length === 0) {
    return <p className="text-sm text-muted">There are no events yet, so there are no draws.</p>;
  }

  // A draft draw is generated, previewed, and published from that event's
  // Manage entries (or Teams) tab; this tab only shows a draw once it's
  // published. A TEAM event's draw is Tie rows, not Match rows.
  const publishedEvents = tournament.events.filter((event) => event.drawPublished);
  if (publishedEvents.length === 0) {
    return (
      <p className="text-sm text-muted">
        No published draws yet. Generate and publish a draw from an event&apos;s Manage entries (or Teams) tab.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <SimpleTable
        columns={[{ label: "Draw" }, { label: "Size", align: "right" }, { label: "Type" }, { label: "Stage" }]}
        rows={publishedEvents.map((event) => ({
          key: event.id,
          cells: [
            <a key="draw" href={`#draw-${event.id}`} className="font-medium underline">
              {event.name}
            </a>,
            event.category === "TEAM" ? `${event.teams.length} teams` : drawSize(event.drawFormat, event.matches),
            drawFormatLabels[event.drawFormat],
            event.category === "TEAM" ? "" : drawStage(event.drawFormat, event.matches),
          ],
        }))}
      />

      {publishedEvents.map((event) =>
        event.category === "TEAM" ? (
          <TeamDrawManager key={event.id} event={event} slug={slug} />
        ) : (
          <EventDrawManager key={event.id} event={event} tournamentName={tournament.name} slug={slug} />
        ),
      )}
    </div>
  );
}
