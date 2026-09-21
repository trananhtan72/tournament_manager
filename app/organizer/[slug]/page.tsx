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
    include: { events: { orderBy: { type: "asc" } } },
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
        <Link href={`/t/${tournament.slug}`} className="text-sm underline">
          View public page
        </Link>
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
                key={`${event.id}:${event.type}:${event.drawFormat}`}
                tournamentSlug={tournament.slug}
                eventId={event.id}
                type={event.type}
                drawFormat={event.drawFormat}
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
