import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireOrganizerId } from "@/lib/organizerAccess";
import { AddEventForm } from "@/app/organizer/[slug]/AddEventForm";
import { EventRow } from "@/app/organizer/[slug]/EventRow";

export default async function OrganizerEventsPage({
  params,
}: PageProps<"/organizer/[slug]/events">) {
  const { slug } = await params;
  const userId = await requireOrganizerId();

  const tournament = await prisma.tournament.findFirst({
    where: { slug, organizerId: userId },
    include: {
      events: {
        include: { entries: { select: { status: true } } },
        orderBy: { name: "asc" },
      },
    },
  });
  if (!tournament) notFound();

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Events</h2>
      {tournament.events.length === 0 ? (
        <p className="text-sm text-muted">No events yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {tournament.events.map((event) => (
            <EventRow
              key={[
                event.id,
                event.name,
                event.category,
                event.drawFormat,
                event.gamesPerMatch,
                event.pointsPerGame,
                event.knockoutGamesPerMatch,
                event.knockoutPointsPerGame,
              ].join(":")}
              tournamentSlug={tournament.slug}
              eventId={event.id}
              name={event.name}
              category={event.category}
              drawFormat={event.drawFormat}
              gamesPerMatch={event.gamesPerMatch}
              pointsPerGame={event.pointsPerGame}
              knockoutGamesPerMatch={event.knockoutGamesPerMatch}
              knockoutPointsPerGame={event.knockoutPointsPerGame}
              entryCount={event.entries.length}
              pendingApprovalCount={event.entries.filter((e) => e.status === "PENDING_APPROVAL").length}
            />
          ))}
        </ul>
      )}
      <AddEventForm tournamentId={tournament.id} />
    </section>
  );
}
