import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isDoublesCategory } from "@/lib/eventLabels";
import { formatDate } from "@/lib/formatDate";
import { registrationIsOpen } from "@/lib/registrationDeadline";
import { playerName, playerEmail } from "@/lib/playerDisplay";
import {
  EventRegistrationPanel,
  type MyEntryInfo,
} from "@/app/t/[slug]/EventRegistrationPanel";

export default async function TournamentPage({
  params,
}: PageProps<"/t/[slug]">) {
  const { slug } = await params;

  const tournament = await prisma.tournament.findUnique({
    where: { slug },
    include: { events: { orderBy: { name: "asc" } } },
  });

  if (!tournament) notFound();

  const session = await auth();
  const userId = session?.user?.id;

  const myEntryPlayers = userId
    ? await prisma.entryPlayer.findMany({
        where: { userId, entry: { event: { tournamentId: tournament.id } } },
        include: {
          entry: {
            include: { players: { include: { user: true } } },
          },
        },
      })
    : [];

  const myEntryByEventId = new Map<string, MyEntryInfo>();
  for (const ep of myEntryPlayers) {
    const other = ep.entry.players.find((p) => p.userId !== userId);
    myEntryByEventId.set(ep.entry.eventId, {
      entryId: ep.entry.id,
      status: ep.entry.status,
      myRole: ep.role,
      myConfirmed: ep.confirmed,
      otherPlayer: other ? { name: playerName(other), email: playerEmail(other) } : null,
    });
  }

  const registrationOpen = registrationIsOpen(tournament.registrationDeadline);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{tournament.name}</h1>
        <p className="text-slate-600 dark:text-slate-400">
          {tournament.venue} · {formatDate(tournament.startDate)} –{" "}
          {formatDate(tournament.endDate)}
        </p>
        <p className="text-sm text-slate-500">
          Registration deadline: {formatDate(tournament.registrationDeadline)}
        </p>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Events</h2>
        {tournament.events.length === 0 ? (
          <p className="text-sm text-slate-500">
            No events have been added yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {tournament.events.map((event) => (
              <li
                key={event.id}
                className="flex flex-col gap-3 rounded-md border border-slate-200 px-4 py-3 dark:border-slate-700"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{event.name}</span>
                  {event.drawPublished && (
                    <Link href={`/t/${slug}/${event.id}`} className="text-sm underline">
                      View draw →
                    </Link>
                  )}
                </div>
                <EventRegistrationPanel
                  eventId={event.id}
                  isDoubles={isDoublesCategory(event.category)}
                  registrationOpen={registrationOpen}
                  signedIn={Boolean(userId)}
                  myEntry={myEntryByEventId.get(event.id) ?? null}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
