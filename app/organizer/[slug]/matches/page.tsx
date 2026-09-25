import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireOrganizerId } from "@/lib/organizerAccess";
import { MatchCard } from "@/components/Bracket";
import { toBracketMatchView, toScorable } from "@/lib/matchView";
import { isLiveMatch, loadLiveStates } from "@/lib/liveMatches";
import { courtNumbers } from "@/lib/tournament/courts";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { MatchRefereeForm } from "@/app/organizer/[slug]/referees/MatchRefereeForm";
import { gameFormatForMatch } from "@/lib/tournament/gameFormat";
import { formatScheduleLabel, knockoutRoundCount, sortSchedule, stageLabel } from "@/lib/tournament/schedule";
import { MatchResultForm } from "@/app/organizer/[slug]/matches/MatchResultForm";

export default async function MatchCenterPage({
  params,
}: PageProps<"/organizer/[slug]/matches">) {
  const { slug } = await params;
  const userId = await requireOrganizerId();

  const tournament = await prisma.tournament.findFirst({
    where: { slug, organizerId: userId },
    include: {
      referees: { include: { user: { select: { name: true } } } },
      events: {
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

  // Results can only be entered once an event's draw is published.
  const draftDraws = tournament.events.filter((e) => !e.drawPublished && e.matches.length > 0).length;
  const items = tournament.events
    .filter((event) => event.drawPublished)
    .flatMap((event) => {
      const knockoutRounds = knockoutRoundCount(event.matches);
      const poolNames = new Map(event.pools.map((p) => [p.id, p.name]));
      return event.matches
        .filter((m) => !m.isBye)
        .map((match) => ({
          match,
          eventName: event.name,
          round: match.round,
          position: match.position,
          format: gameFormatForMatch(event, match),
          stage: stageLabel(
            { poolName: match.poolId ? (poolNames.get(match.poolId) ?? null) : null, round: match.round },
            { drawFormat: event.drawFormat, knockoutRounds },
          ),
        }));
    });
  type Item = (typeof items)[number];

  const refereeChoices = tournament.referees
    .map((r) => ({ id: r.id, name: r.user.name }))
    .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
  const refereeName = (id: string | null) => refereeChoices.find((r) => r.id === id)?.name ?? null;

  const formatById = new Map(items.map((i) => [i.match.id, i.format]));
  const liveStates = await loadLiveStates(items.map((i) => i.match), (m) => formatById.get(m.id)!);

  const upcoming = items.filter((i) => i.match.status === null);
  // Matches being scored right now come first, then the rest in play order.
  const upcomingLive = upcoming.filter((i) => isLiveMatch(i.match));
  const notLive = upcoming.filter((i) => !isLiveMatch(i.match));
  const upcomingTimed = sortSchedule(
    notLive.flatMap((i) => (i.match.scheduledAt ? [{ ...i, scheduledAt: i.match.scheduledAt, court: i.match.court }] : [])),
  );
  const upcomingUntimed = notLive
    .filter((i) => !i.match.scheduledAt)
    .sort(
      (a, b) =>
        a.eventName.localeCompare(b.eventName, "en", { numeric: true }) ||
        a.round - b.round ||
        a.position - b.position,
    );
  const played = items
    .filter((i) => i.match.status !== null)
    .sort((a, b) => b.match.updatedAt.getTime() - a.match.updatedAt.getTime());

  function MatchItem({ item }: { item: Item }) {
    const { match, eventName, stage, format } = item;
    const ready = match.entry1 !== null && match.entry2 !== null;
    const live = liveStates.get(match.id) ?? null;
    const liveHref = `/organizer/${slug}/matches/${match.id}`;
    return (
      <li className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-xs">
          <span className="font-medium text-slate-700 dark:text-slate-300">
            {eventName} · {stage}
          </span>
          <span className="text-slate-500">{formatScheduleLabel(match) ?? "Not scheduled"}</span>
        </div>
        {match.status === null ? (
          <details className="text-xs">
            <summary className="cursor-pointer text-slate-600 dark:text-slate-400">
              Referee: {refereeName(match.refereeId) ?? "none"}
            </summary>
            <div className="pt-2">
              <MatchRefereeForm matchId={match.id} currentRefereeId={match.refereeId} referees={refereeChoices} />
            </div>
          </details>
        ) : (
          refereeName(match.refereeId) && <span className="text-xs text-slate-500">Referee: {refereeName(match.refereeId)}</span>
        )}
        {live ? (
          <div className="flex flex-col gap-2">
            <MatchCard match={toBracketMatchView(match, format, { showSchedule: false, live })} />
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href={liveHref}
                className="inline-flex items-center justify-center rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500"
              >
                Continue live scoring
              </Link>
            </div>
            {ready && (
              <details className="text-sm">
                <summary className="cursor-pointer text-slate-600 underline dark:text-slate-400">
                  Enter the result manually instead
                </summary>
                <div className="pt-2">
                  <MatchResultForm
                    key={`${match.id}:${match.status}:${match.winnerId}`}
                    {...toScorable(match, format)}
                  />
                </div>
              </details>
            )}
          </div>
        ) : ready ? (
          <>
            {match.status === null && (
              <div>
                <Link href={liveHref} className="text-sm font-medium underline">
                  Score this match live →
                </Link>
              </div>
            )}
            <MatchResultForm
              key={`${match.id}:${match.status}:${match.winnerId}`}
              {...toScorable(match, format)}
            />
          </>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <MatchCard match={toBracketMatchView(match, format, { showSchedule: false })} />
            <span className="text-xs text-slate-500">Waiting for earlier results</span>
          </div>
        )}
      </li>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Enter results as matches finish. Set times and courts on the{" "}
          <Link href={`/organizer/${slug}/schedule`} className="underline">
            schedule page
          </Link>
          .
        </p>
      </div>

      <details className="rounded-md border border-slate-200 px-4 py-2 text-sm dark:border-slate-700">
        <summary className="cursor-pointer font-medium">Court scoreboard screens</summary>
        <div className="flex flex-col gap-3 pt-3">
          <p className="text-slate-600 dark:text-slate-400">
            Each court has its own full-screen scoreboard for a TV or an iPad at the court: it shows that court&apos;s live
            score, then the final score, then what&apos;s up next. Open a court&apos;s link in the screen&apos;s browser
            (iPad: use landscape, then Share → Add to Home Screen for full screen).
          </p>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {courtNumbers(tournament.courtCount).map((n) => (
              <li key={n} className="flex items-center justify-between gap-3 rounded-md border border-slate-200 px-3 py-1.5 dark:border-slate-700">
                <a href={`/t/${slug}/court/${n}`} target="_blank" rel="noopener" className="underline">
                  Court {n} ↗
                </a>
                <CopyLinkButton href={`/t/${slug}/court/${n}`} />
              </li>
            ))}
          </ul>
        </div>
      </details>

      {draftDraws > 0 && (
        <p className="rounded-md border border-slate-200 px-4 py-2 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-400">
          {draftDraws} {draftDraws === 1 ? "event has" : "events have"} a draw that isn&apos;t published yet, so
          {draftDraws === 1 ? " its" : " their"} matches aren&apos;t listed here.{" "}
          <Link href={`/organizer/${slug}/draws`} className="underline">
            Go to Draws
          </Link>
        </p>
      )}

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-6">
        <section aria-labelledby="upcoming-heading" className="flex min-w-0 flex-col gap-4">
          <h2 id="upcoming-heading" className="text-lg font-semibold">
            Upcoming matches ({upcoming.length})
          </h2>
          {upcoming.length === 0 ? (
            <p className="text-sm text-slate-500">
              {items.length === 0 ? "No published draws yet." : "No matches left to play."}
            </p>
          ) : (
            <>
              {upcomingLive.length > 0 && (
                <div className="flex flex-col gap-3">
                  <h3 className="text-sm font-semibold text-red-600 dark:text-red-400">Live now</h3>
                  <ul className="flex flex-col gap-4">
                    {upcomingLive.map((item) => (
                      <MatchItem key={item.match.id} item={item} />
                    ))}
                  </ul>
                </div>
              )}
              {upcomingTimed.length > 0 && (
                <ul className="flex flex-col gap-4">
                  {upcomingTimed.map((item) => (
                    <MatchItem key={item.match.id} item={item} />
                  ))}
                </ul>
              )}
              {upcomingUntimed.length > 0 && (
                <div className="flex flex-col gap-3">
                  {(upcomingTimed.length > 0 || upcomingLive.length > 0) && (
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Not scheduled yet</h3>
                  )}
                  <ul className="flex flex-col gap-4">
                    {upcomingUntimed.map((item) => (
                      <MatchItem key={item.match.id} item={item} />
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </section>

        <section aria-labelledby="played-heading" className="flex min-w-0 flex-col gap-4">
          <h2 id="played-heading" className="text-lg font-semibold">
            Played matches ({played.length})
          </h2>
          {played.length === 0 ? (
            <p className="text-sm text-slate-500">No matches have been played yet.</p>
          ) : (
            <ul className="flex flex-col gap-4">
              {played.map((item) => (
                <MatchItem key={item.match.id} item={item} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
