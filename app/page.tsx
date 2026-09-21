import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/formatDate";

function categorize(tournaments: Awaited<ReturnType<typeof getTournaments>>) {
  const now = new Date();
  return {
    ongoing: tournaments.filter((t) => t.startDate <= now && t.endDate >= now),
    upcoming: tournaments.filter((t) => t.startDate > now),
    past: tournaments.filter((t) => t.endDate < now),
  };
}

async function getTournaments() {
  return prisma.tournament.findMany({
    orderBy: { startDate: "asc" },
    include: { _count: { select: { events: true } } },
  });
}

function formatDateRange(start: Date, end: Date) {
  return start.getTime() === end.getTime()
    ? formatDate(start)
    : `${formatDate(start)} – ${formatDate(end)}`;
}

function TournamentList({
  title,
  tournaments,
}: {
  title: string;
  tournaments: Awaited<ReturnType<typeof getTournaments>>;
}) {
  if (tournaments.length === 0) return null;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      <ul className="flex flex-col gap-2">
        {tournaments.map((t) => (
          <li key={t.id}>
            <Link
              href={`/t/${t.slug}`}
              className="flex flex-col gap-1 rounded-md border border-slate-200 px-4 py-3 hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-500"
            >
              <span className="font-medium">{t.name}</span>
              <span className="text-sm text-slate-600 dark:text-slate-400">
                {t.venue} · {formatDateRange(t.startDate, t.endDate)} ·{" "}
                {t._count.events} event{t._count.events === 1 ? "" : "s"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function HomePage() {
  const tournaments = await getTournaments();
  const { ongoing, upcoming, past } = categorize(tournaments);

  if (tournaments.length === 0) {
    return (
      <div className="text-center text-slate-600 dark:text-slate-400">
        <p>No tournaments yet.</p>
        <Link href="/organizer" className="underline">
          Create the first one
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <TournamentList title="Ongoing" tournaments={ongoing} />
      <TournamentList title="Upcoming" tournaments={upcoming} />
      <TournamentList title="Past" tournaments={past} />
    </div>
  );
}
