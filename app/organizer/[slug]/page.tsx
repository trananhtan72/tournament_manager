import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { EditTournamentForm } from "@/app/organizer/[slug]/EditTournamentForm";
import { AddEventForm } from "@/app/organizer/[slug]/AddEventForm";
import { EventRow } from "@/app/organizer/[slug]/EventRow";
import { ActionForm } from "@/components/ActionForm";
import { deleteTournament } from "@/app/actions/tournaments";

export default async function OrganizerTournamentPage({
  params,
}: PageProps<"/organizer/[slug]">) {
  const { slug } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    redirect("/signin");
  }

  const tournament = await prisma.tournament.findUnique({
    where: { slug },
    include: {
      events: {
        include: { entries: { select: { status: true } } },
        orderBy: { name: "asc" },
      },
    },
  });

  if (!tournament || tournament.organizerId !== session.user.id) {
    notFound();
  }

  const deleteWithId = deleteTournament.bind(null, tournament.id);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <Link href="/organizer" className="text-sm underline">
          ← Your tournaments
        </Link>
        <div className="flex items-center gap-4">
          <Link href={`/organizer/${tournament.slug}/schedule`} className="text-sm underline">
            Manage schedule
          </Link>
          <Link href={`/t/${tournament.slug}`} className="text-sm underline">
            View public page
          </Link>
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <h1 className="text-xl font-semibold">Tournament details</h1>
        <EditTournamentForm
          key={tournament.updatedAt.getTime()}
          tournamentId={tournament.id}
          name={tournament.name}
          venue={tournament.venue}
          startDate={tournament.startDate}
          endDate={tournament.endDate}
          registrationDeadline={tournament.registrationDeadline}
          registrationOpensAt={tournament.registrationOpensAt}
          withdrawalDeadline={tournament.withdrawalDeadline}
          regulationsUrl={tournament.regulationsUrl}
        />
      </section>

      <section className="flex flex-col gap-3 border-t border-slate-200 pt-6 dark:border-slate-800">
        <h2 className="text-lg font-semibold">Events</h2>
        {tournament.events.length === 0 ? (
          <p className="text-sm text-slate-500">No events yet.</p>
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

      <section className="flex flex-col gap-3 border-t border-slate-200 pt-6 dark:border-slate-800">
        <h2 className="text-lg font-semibold text-red-600 dark:text-red-400">
          Danger zone
        </h2>
        <ActionForm
          action={deleteWithId}
          variant="danger"
          label="Delete tournament"
          pendingLabel="Deleting…"
          confirmMessage={`Delete "${tournament.name}"? This will remove all its events and cannot be undone.`}
        />
      </section>
    </div>
  );
}
