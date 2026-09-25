import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { MatchCard } from "@/components/Bracket";
import { toBracketMatchView } from "@/lib/matchView";
import { tournamentTabMetadata } from "@/lib/tournamentMetadata";
import { gameFormatForMatch } from "@/lib/tournament/gameFormat";
import {
  formatDayHeading,
  formatTimeOfDay,
  groupByDay,
  knockoutRoundCount,
  sortSchedule,
  stageLabel,
} from "@/lib/tournament/schedule";

export function generateMetadata({ params }: PageProps<"/t/[slug]/matches">): Promise<Metadata> {
  return tournamentTabMetadata(params, "Matches");
}

export default async function MatchesTab({ params }: PageProps<"/t/[slug]/matches">) {
  const { slug } = await params;

  const tournament = await prisma.tournament.findUnique({
    where: { slug },
    include: {
      events: {
        // Matches only exist publicly once their event's draw is published.
        where: { drawPublished: true },
        orderBy: { name: "asc" },
        include: {
          pools: true,
          matches: {
            include: {
              entry1: { include: { players: { include: { user: true } } } },
              entry2: { include: { players: { include: { user: true } } } },
              winner: { include: { players: { include: { user: true } } } },
              games: { orderBy: { gameNumber: "asc" } },
            },
          },
        },
      },
    },
  });
  if (!tournament) notFound();

  const playable = tournament.events.flatMap((event) => {
    const knockoutRounds = knockoutRoundCount(event.matches);
    const poolNames = new Map(event.pools.map((p) => [p.id, p.name]));
    return event.matches
      .filter((m) => !m.isBye)
      .map((m) => ({
        match: m,
        eventId: event.id,
        eventName: event.name,
        round: m.round,
        position: m.position,
        stage: stageLabel(
          { poolName: m.poolId ? (poolNames.get(m.poolId) ?? null) : null, round: m.round },
          { drawFormat: event.drawFormat, knockoutRounds },
        ),
        view: toBracketMatchView(m, gameFormatForMatch(event, m), { showSchedule: false }),
      }));
  });

  const scheduled = playable.flatMap((p) =>
    p.match.scheduledAt ? [{ ...p, scheduledAt: p.match.scheduledAt, court: p.match.court }] : [],
  );
  const days = groupByDay(sortSchedule(scheduled));

  // The rest, grouped by event and stage in draw order.
  const unscheduled = playable
    .filter((p) => !p.match.scheduledAt)
    .sort(
      (a, b) =>
        a.eventName.localeCompare(b.eventName, "en", { numeric: true }) ||
        a.round - b.round ||
        a.position - b.position,
    );
  const unscheduledGroups = new Map<
    string,
    { eventId: string; eventName: string; stage: string; items: typeof unscheduled }
  >();
  for (const item of unscheduled) {
    const key = `${item.eventId}:${item.stage}`;
    const group = unscheduledGroups.get(key) ?? {
      eventId: item.eventId,
      eventName: item.eventName,
      stage: item.stage,
      items: [],
    };
    group.items.push(item);
    unscheduledGroups.set(key, group);
  }

  if (playable.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        No draws have been published yet, so there are no matches to show.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <p className="text-sm text-slate-600 dark:text-slate-400">
        {playable.length} {playable.length === 1 ? "match" : "matches"} · times are local to the venue
      </p>

      {days.length === 0 && (
        <p className="text-sm text-slate-500">The schedule hasn&apos;t been set yet. Check back soon.</p>
      )}

      {days.map((day) => (
        <section key={day.day} className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">{formatDayHeading(day.date)}</h2>
          <ul className="flex flex-col gap-2">
            {day.items.map((item) => (
              <li
                key={item.match.id}
                className="flex flex-col gap-2 rounded-md border border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 dark:border-slate-700"
              >
                <div className="flex shrink-0 items-baseline gap-2 sm:w-28 sm:flex-col sm:items-start sm:gap-0">
                  <span className="font-semibold tabular-nums">{formatTimeOfDay(item.scheduledAt)}</span>
                  {item.court && (
                    <span className="text-sm text-slate-600 dark:text-slate-400">{item.court}</span>
                  )}
                </div>
                <MatchCard match={item.view} />
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  <Link href={`/t/${slug}/${item.eventId}`} className="underline">
                    {item.eventName}
                  </Link>
                  <span> · {item.stage}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {unscheduled.length > 0 && (
        <section className="flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-semibold">
              {days.length > 0 ? "Not yet scheduled" : "Matches"}
            </h2>
            {days.length > 0 && (
              <p className="text-sm text-slate-500">These matches don&apos;t have a time yet.</p>
            )}
          </div>
          {[...unscheduledGroups.entries()].map(([key, group]) => (
            <div key={key} className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                <Link href={`/t/${slug}/${group.eventId}`} className="underline">
                  {group.eventName}
                </Link>
                <span> · {group.stage}</span>
              </h3>
              <div className="flex flex-wrap gap-3">
                {group.items.map((item) => (
                  <MatchCard key={item.match.id} match={item.view} />
                ))}
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
