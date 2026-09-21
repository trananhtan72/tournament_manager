import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { eventTypeLabels } from "@/lib/eventLabels";
import { formatDate } from "@/lib/formatDate";

export default async function TournamentPage({
  params,
}: PageProps<"/t/[slug]">) {
  const { slug } = await params;

  const tournament = await prisma.tournament.findUnique({
    where: { slug },
    include: { events: { orderBy: { type: "asc" } } },
  });

  if (!tournament) notFound();

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
          <ul className="flex flex-col gap-2">
            {tournament.events.map((event) => (
              <li
                key={event.id}
                className="rounded-md border border-slate-200 px-4 py-3 dark:border-slate-700"
              >
                {eventTypeLabels[event.type]}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
