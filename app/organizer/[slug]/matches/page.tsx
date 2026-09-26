import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireOrganizerId } from "@/lib/organizerAccess";
import { toBracketMatchView, toScorable } from "@/lib/matchView";
import { isLiveMatch, loadLiveStates } from "@/lib/liveMatches";
import { courtNumbers } from "@/lib/tournament/courts";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { MatchRefereeForm } from "@/app/organizer/[slug]/referees/MatchRefereeForm";
import { gameFormatForMatch } from "@/lib/tournament/gameFormat";
import { formatScheduleLabel, knockoutRoundCount, sortSchedule, stageLabel } from "@/lib/tournament/schedule";
import { MatchResultForm } from "@/app/organizer/[slug]/matches/MatchResultForm";
import { EventFilter } from "@/app/organizer/[slug]/matches/EventFilter";

// Shared by the "Live match score" link and the "Enter manually" summary
// below, so the two read as one pair of equal-weight options.
const scoreOptionClass =
  "inline-flex items-center justify-center rounded-md border border-border px-3 py-1.5 text-sm font-medium text-text hover:bg-surface-muted";

/**
 * Who's playing, plain and simple — names first, a compact score only where
 * there is one. Every match in this list gets exactly this line regardless
 * of its state (not started, live, played, or still waiting on earlier
 * results), so scanning the list always tells you who's involved without
 * opening anything.
 */
function MatchSummary({
  entry1Label,
  entry2Label,
  winnerLabel,
  isBye,
  games,
  liveScore,
  liveTag,
}: {
  entry1Label: string | null;
  entry2Label: string | null;
  winnerLabel: string | null;
  isBye: boolean;
  /** Final per-game scores, for a played match; omit for anything else. */
  games?: { entry1Score: number; entry2Score: number }[];
  /** The game in progress, for a live match. */
  liveScore?: { score1: number; score2: number } | null;
  liveTag?: string | null;
}) {
  const name1 = entry1Label ?? "TBD";
  const name2 = isBye ? "Bye" : (entry2Label ?? "TBD");
  const isWinner1 = winnerLabel !== null && winnerLabel === entry1Label;
  const isWinner2 = winnerLabel !== null && winnerLabel === entry2Label;
  const nameClass = (isWinner: boolean, isLoser: boolean) =>
    isWinner ? "font-semibold text-text" : isLoser ? "text-muted" : "font-medium text-text";
  const scoreText =
    !liveScore && games && games.length > 0 ? games.map((g) => `${g.entry1Score}–${g.entry2Score}`).join(", ") : null;

  return (
    <p className="text-[0.95rem]">
      {liveTag && (
        <span className="mr-2 inline-flex items-center gap-1.5 text-xs font-semibold text-accent">
          <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-accent" aria-hidden />
          {liveTag}
        </span>
      )}
      <span className={nameClass(isWinner1, isWinner2)}>{name1}</span>
      <span className="mx-1.5 text-muted">vs</span>
      <span className={nameClass(isWinner2, isWinner1)}>{name2}</span>
      {liveScore && (
        <span className="ml-2 tabular-nums text-accent">
          {liveScore.score1}–{liveScore.score2}
        </span>
      )}
      {scoreText && <span className="ml-2 text-sm tabular-nums text-muted">{scoreText}</span>}
    </p>
  );
}

export default async function MatchCenterPage({
  params,
  searchParams,
}: PageProps<"/organizer/[slug]/matches">) {
  const { slug } = await params;
  const { event: rawEventFilter } = await searchParams;
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
  const publishedEvents = tournament.events.filter((event) => event.drawPublished);
  const items = publishedEvents.flatMap((event) => {
    const knockoutRounds = knockoutRoundCount(event.matches);
    const poolNames = new Map(event.pools.map((p) => [p.id, p.name]));
    return event.matches
      .filter((m) => !m.isBye)
      .map((match) => ({
        match,
        eventId: event.id,
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

  // A tournament with several events can pile up a lot of matches here; an
  // unrecognized or missing ?event= just falls back to "All" rather than
  // erroring or showing an empty page.
  const eventChoices = publishedEvents.map((e) => ({ id: e.id, name: e.name }));
  const selectedEventId =
    typeof rawEventFilter === "string" && eventChoices.some((e) => e.id === rawEventFilter) ? rawEventFilter : null;
  const filteredItems = selectedEventId ? items.filter((i) => i.eventId === selectedEventId) : items;

  const refereeChoices = tournament.referees
    .map((r) => ({ id: r.id, name: r.user.name }))
    .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
  const refereeName = (id: string | null) => refereeChoices.find((r) => r.id === id)?.name ?? null;

  const formatById = new Map(filteredItems.map((i) => [i.match.id, i.format]));
  const liveStates = await loadLiveStates(filteredItems.map((i) => i.match), (m) => formatById.get(m.id)!);

  const upcoming = filteredItems.filter((i) => i.match.status === null);
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
  const played = filteredItems
    .filter((i) => i.match.status !== null)
    .sort((a, b) => b.match.updatedAt.getTime() - a.match.updatedAt.getTime());

  function MatchItem({ item }: { item: Item }) {
    const { match, eventName, stage, format } = item;
    const ready = match.entry1 !== null && match.entry2 !== null;
    const live = liveStates.get(match.id) ?? null;
    const liveHref = `/organizer/${slug}/matches/${match.id}`;
    const view = toBracketMatchView(match, format, { showSchedule: false });
    const currentGame = live ? live.games[live.games.length - 1] : null;

    return (
      <li className="flex flex-col gap-2 rounded-md border border-border px-4 py-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-xs">
          <span className="font-medium text-text">
            {eventName} · {stage}
          </span>
          <span className="text-muted">{formatScheduleLabel(match) ?? "Not scheduled"}</span>
        </div>

        <MatchSummary
          entry1Label={view.entry1Label}
          entry2Label={view.entry2Label}
          winnerLabel={view.winnerLabel}
          isBye={view.isBye}
          games={match.status !== null ? view.games : undefined}
          liveScore={currentGame ? { score1: currentGame.score1, score2: currentGame.score2 } : null}
          liveTag={live ? `Live · Game ${live.currentGame}` : null}
        />

        {match.status === null ? (
          <details className="text-xs">
            <summary className="cursor-pointer text-muted">
              Referee: {refereeName(match.refereeId) ?? "none"}
            </summary>
            <div className="pt-2">
              <MatchRefereeForm matchId={match.id} currentRefereeId={match.refereeId} referees={refereeChoices} />
            </div>
          </details>
        ) : (
          refereeName(match.refereeId) && <span className="text-xs text-muted">Referee: {refereeName(match.refereeId)}</span>
        )}

        {live ? (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href={liveHref}
                className="inline-flex items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent/90"
              >
                Continue live scoring
              </Link>
            </div>
            {ready && (
              <details className="text-sm">
                <summary className="cursor-pointer text-muted underline">
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
          match.status === null ? (
            // Not started yet: two equal options instead of the full score-entry
            // form taking up space by default — it only appears once "Enter
            // manually" is opened.
            <div className="flex flex-wrap gap-2">
              <Link href={liveHref} className={scoreOptionClass}>
                Live match score
              </Link>
              <details className="[&_summary]:list-none">
                <summary className={`cursor-pointer ${scoreOptionClass} [&::-webkit-details-marker]:hidden`}>
                  Enter manually
                </summary>
                <div className="pt-2">
                  <MatchResultForm
                    key={`${match.id}:${match.status}:${match.winnerId}`}
                    {...toScorable(match, format)}
                  />
                </div>
              </details>
            </div>
          ) : (
            <MatchResultForm
              key={`${match.id}:${match.status}:${match.winnerId}`}
              {...toScorable(match, format)}
            />
          )
        ) : (
          <span className="text-xs text-muted">Waiting for earlier results</span>
        )}
      </li>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          Enter results as matches finish. Set times and courts on the{" "}
          <Link href={`/organizer/${slug}/schedule`} className="underline">
            schedule page
          </Link>
          .
        </p>
        {eventChoices.length > 0 && <EventFilter events={eventChoices} />}
      </div>

      <details className="rounded-md border border-border px-4 py-2 text-sm">
        <summary className="cursor-pointer font-medium">Court scoreboard screens</summary>
        <div className="flex flex-col gap-3 pt-3">
          <p className="text-muted">
            Each court has its own full-screen scoreboard for a TV or an iPad at the court: it shows that court&apos;s live
            score, then the final score, then what&apos;s up next. Open a court&apos;s link in the screen&apos;s browser
            (iPad: use landscape, then Share → Add to Home Screen for full screen).
          </p>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {courtNumbers(tournament.courtCount).map((n) => (
              <li key={n} className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-1.5">
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
        <p className="rounded-md border border-border px-4 py-2 text-sm text-muted">
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
            <p className="text-sm text-muted">
              {items.length === 0
                ? "No published draws yet."
                : selectedEventId
                  ? "No matches left to play in this event."
                  : "No matches left to play."}
            </p>
          ) : (
            <>
              {upcomingLive.length > 0 && (
                <div className="flex flex-col gap-3">
                  <h3 className="text-sm font-semibold text-accent">Live now</h3>
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
                    <h3 className="text-sm font-semibold text-text">Not scheduled yet</h3>
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
            <p className="text-sm text-muted">
              {selectedEventId ? "No matches played yet in this event." : "No matches have been played yet."}
            </p>
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
