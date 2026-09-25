import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { entryDisplayName } from "@/lib/playerDisplay";
import { formatDate } from "@/lib/formatDate";
import { dayKey, knockoutRoundCount, stageLabel, toDateTimeLocal } from "@/lib/tournament/schedule";
import { COURT_SUGGESTIONS_ID, MatchScheduleForm } from "@/app/organizer/[slug]/schedule/MatchScheduleForm";

export const metadata: Metadata = { title: "Match schedule" };

export default async function OrganizerSchedulePage({
  params,
}: PageProps<"/organizer/[slug]/schedule">) {
  const { slug } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    redirect("/signin");
  }

  const tournament = await prisma.tournament.findUnique({
    where: { slug },
    include: {
      events: {
        orderBy: { name: "asc" },
        include: {
          pools: true,
          matches: {
            orderBy: [{ round: "asc" }, { position: "asc" }],
            include: {
              entry1: { include: { players: { include: { user: true } } } },
              entry2: { include: { players: { include: { user: true } } } },
            },
          },
        },
      },
    },
  });
  if (!tournament || tournament.organizerId !== session.user.id) {
    notFound();
  }

  const firstDay = dayKey(tournament.startDate);
  const lastDay = dayKey(tournament.endDate);

  const events = tournament.events
    .map((event) => {
      const knockoutRounds = knockoutRoundCount(event.matches);
      const poolNames = new Map(event.pools.map((p) => [p.id, p.name]));
      const groups = new Map<string, { title: string; matches: typeof event.matches }>();
      for (const match of event.matches) {
        if (match.isBye) continue;
        const title = stageLabel(
          { poolName: match.poolId ? (poolNames.get(match.poolId) ?? null) : null, round: match.round },
          { drawFormat: event.drawFormat, knockoutRounds },
        );
        const group = groups.get(title) ?? { title, matches: [] };
        group.matches.push(match);
        groups.set(title, group);
      }
      return { event, groups: [...groups.values()] };
    })
    .filter(({ groups }) => groups.length > 0);

  const allMatches = events.flatMap(({ groups }) => groups.flatMap((g) => g.matches));
  const scheduledCount = allMatches.filter((m) => m.scheduledAt !== null).length;
  const courtNames = [
    ...new Set(allMatches.map((m) => m.court).filter((c): c is string => c !== null)),
  ].sort((a, b) => a.localeCompare(b, "en", { numeric: true }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href={`/organizer/${slug}/matches`} className="text-sm underline">
          ← Match center
        </Link>
        <Link href={`/t/${slug}/matches`} className="text-sm underline">
          View public matches
        </Link>
      </div>

      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Match schedule</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Give each match a start time and, if you like, a court. Times are local to the venue
          ({formatDate(tournament.startDate)} – {formatDate(tournament.endDate)}). Players see the
          schedule once an event&apos;s draw is published.
        </p>
        {allMatches.length > 0 && (
          <p className="text-sm text-slate-500">
            {scheduledCount} of {allMatches.length} matches scheduled.
          </p>
        )}
      </div>

      <datalist id={COURT_SUGGESTIONS_ID}>
        {courtNames.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>

      {events.length === 0 ? (
        <p className="text-sm text-slate-500">
          There are no matches to schedule yet. Generate a draw for an event first.
        </p>
      ) : (
        events.map(({ event, groups }) => (
          <section key={event.id} className="flex flex-col gap-4 border-t border-slate-200 pt-6 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-lg font-semibold">{event.name}</h2>
              {!event.drawPublished && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  Draw not published — hidden from players
                </span>
              )}
            </div>
            {groups.map((group) => (
              <div key={group.title} className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{group.title}</h3>
                <ul className="flex flex-col gap-2">
                  {group.matches.map((match) => (
                    <li
                      key={match.id}
                      className="flex flex-col gap-2 rounded-md border border-slate-200 px-4 py-3 md:flex-row md:items-center md:justify-between dark:border-slate-700"
                    >
                      <div className="min-w-0 text-sm">
                        <span className="font-medium">
                          {match.entry1 ? entryDisplayName(match.entry1) : "TBD"}
                        </span>{" "}
                        <span className="text-slate-500">vs</span>{" "}
                        <span className="font-medium">
                          {match.entry2 ? entryDisplayName(match.entry2) : "TBD"}
                        </span>
                        {match.status && (
                          <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                            Played
                          </span>
                        )}
                      </div>
                      <MatchScheduleForm
                        matchId={match.id}
                        initialScheduledAt={match.scheduledAt ? toDateTimeLocal(match.scheduledAt) : ""}
                        initialCourt={match.court ?? ""}
                        firstDay={firstDay}
                        lastDay={lastDay}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        ))
      )}
    </div>
  );
}
