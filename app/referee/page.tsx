import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { MatchCard } from "@/components/Bracket";
import { AutoRefresh } from "@/components/AutoRefresh";
import { toBracketMatchView } from "@/lib/matchView";
import { isLiveMatch, loadLiveStates } from "@/lib/liveMatches";
import { gameFormatForMatch } from "@/lib/tournament/gameFormat";
import {
  formatScheduleLabel,
  formatStartedLabel,
  knockoutRoundCount,
  stageLabel,
} from "@/lib/tournament/schedule";

export const metadata: Metadata = { title: "My matches to referee" };

const buttonClass =
  "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium text-white";

export default async function RefereeHomePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  const userId = session.user.id;

  const matches = await prisma.match.findMany({
    where: { isBye: false, referee: { userId } },
    include: {
      pool: true,
      event: { include: { tournament: true, matches: { select: { poolId: true, round: true } } } },
      entry1: { include: { players: { include: { user: true } } } },
      entry2: { include: { players: { include: { user: true } } } },
      winner: { include: { players: { include: { user: true } } } },
      games: { orderBy: { gameNumber: "asc" } },
    },
  });

  const liveStates = await loadLiveStates(matches, (m) => gameFormatForMatch(m.event, m));
  const rows = matches.map((match) => ({
    match,
    stage: stageLabel(
      { poolName: match.pool?.name ?? null, round: match.round },
      { drawFormat: match.event.drawFormat, knockoutRounds: knockoutRoundCount(match.event.matches) },
    ),
    view: toBracketMatchView(match, gameFormatForMatch(match.event, match), {
      showSchedule: false,
      live: liveStates.get(match.id) ?? null,
    }),
  }));
  type Row = (typeof rows)[number];

  // Matches in progress first, then the rest by when they're scheduled (unscheduled last).
  const todo = rows
    .filter((r) => r.match.status === null)
    .sort(
      (a, b) =>
        Number(isLiveMatch(b.match)) - Number(isLiveMatch(a.match)) ||
        (a.match.scheduledAt?.getTime() ?? Infinity) - (b.match.scheduledAt?.getTime() ?? Infinity) ||
        a.match.event.tournament.startDate.getTime() - b.match.event.tournament.startDate.getTime() ||
        a.match.round - b.match.round ||
        a.match.position - b.match.position,
    );
  const done = rows
    .filter((r) => r.match.status !== null)
    .sort((a, b) => b.match.updatedAt.getTime() - a.match.updatedAt.getTime())
    .slice(0, 20);

  function MatchItem({ row }: { row: Row }) {
    const { match, stage, view } = row;
    const live = isLiveMatch(match);
    const ready = match.event.drawPublished && match.entry1 && match.entry2 && match.status === null;
    const when =
      match.status !== null ? formatStartedLabel(match.startedAt) : formatScheduleLabel(match);
    return (
      <li className="flex flex-col gap-3 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
        <div className="flex flex-col gap-0.5 text-sm">
          <span className="font-medium">
            {match.event.tournament.name} · {match.event.name}
          </span>
          <span className="text-slate-600 dark:text-slate-400">{stage}</span>
          {when && <span className="text-slate-600 dark:text-slate-400">{when}</span>}
        </div>
        <MatchCard match={view} />
        {match.status === null &&
          (ready ? (
            <div>
              <Link
                href={`/referee/matches/${match.id}`}
                className={`${buttonClass} ${live ? "bg-red-600 hover:bg-red-500" : "bg-slate-900 hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"}`}
              >
                {live ? "Continue live scoring" : "Score this match"}
              </Link>
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              {!match.event.drawPublished
                ? "Scoring opens once the draw is published."
                : "Scoring opens once both players are known."}
            </p>
          ))}
      </li>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <AutoRefresh intervalMs={todo.some((r) => isLiveMatch(r.match)) ? 6000 : 30000} />
      <div>
        <h1 className="text-xl font-semibold">Matches I&apos;m refereeing</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Score the matches you&apos;ve been assigned live, from your phone or tablet. The organizer can see and change
          everything.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">To officiate ({todo.length})</h2>
        {todo.length === 0 ? (
          <p className="text-sm text-slate-500">
            Nothing assigned right now. You&apos;ll get a notification when the organizer assigns you a match.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {todo.map((row) => (
              <MatchItem key={row.match.id} row={row} />
            ))}
          </ul>
        )}
      </section>

      {done.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Completed</h2>
          <ul className="flex flex-col gap-3">
            {done.map((row) => (
              <MatchItem key={row.match.id} row={row} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
