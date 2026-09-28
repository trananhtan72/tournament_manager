import type { Prisma } from "@prisma/client";
import { drawFormatLabels } from "@/lib/eventLabels";
import { entryDisplayName } from "@/lib/playerDisplay";
import { gameFormatForMatch, describeEventGameFormats } from "@/lib/tournament/gameFormat";
import { ActionForm } from "@/components/ActionForm";
import { Bracket, MatchCard, type BracketMatchView } from "@/components/Bracket";
import { PrintDrawButton } from "@/components/PrintDrawButton";
import { StandingsTable } from "@/components/StandingsTable";
import { standingsFor, toBracketMatchView, toScorable } from "@/lib/matchView";
import { computeRoundRobinStandings } from "@/lib/tournament/roundRobin";
import { selectKnockoutAdvancers, inferAdvancesPerPool } from "@/lib/tournament/pools";
import { publishDraw, unpublishDraw } from "@/app/actions/draws";
import { GenerateDrawForm } from "@/app/organizer/[slug]/draws/GenerateDrawForm";
import { GenerateManualDrawForm } from "@/app/organizer/[slug]/draws/GenerateManualDrawForm";
import { GenerateKnockoutForm } from "@/app/organizer/[slug]/draws/GenerateKnockoutForm";
import { GenerateManualKnockoutForm } from "@/app/organizer/[slug]/draws/GenerateManualKnockoutForm";
import { SwapEntriesForm } from "@/app/organizer/[slug]/draws/SwapEntriesForm";
import { MoveEntryToByeForm } from "@/app/organizer/[slug]/draws/MoveEntryToByeForm";
import { SwapPoolEntriesForm } from "@/app/organizer/[slug]/draws/SwapPoolEntriesForm";
import { MovePoolEntryForm } from "@/app/organizer/[slug]/draws/MovePoolEntryForm";
import { EntryPositionForm } from "@/app/organizer/[slug]/draws/EntryPositionForm";
import { StartMatchDialog } from "@/app/organizer/[slug]/draws/StartMatchDialog";

/** What an event needs loaded to manage its draw. Only confirmed entries take part. */
export const drawEventInclude = {
  entries: {
    where: { status: "CONFIRMED" },
    include: { players: { include: { user: true } } },
  },
  pools: {
    orderBy: { name: "asc" },
    include: { entries: { include: { players: { include: { user: true } } } } },
  },
  matches: {
    include: {
      entry1: { include: { players: { include: { user: true } } } },
      entry2: { include: { players: { include: { user: true } } } },
      winner: { include: { players: { include: { user: true } } } },
      games: { orderBy: { gameNumber: "asc" } },
    },
    orderBy: [{ round: "asc" }, { position: "asc" }],
  },
} satisfies Prisma.EventInclude;

export type DrawEvent = Prisma.EventGetPayload<{ include: typeof drawEventInclude }>;

/**
 * One row per confirmed entry, during a manual draw: its name and a position
 * picker (1..bracket size). Position 1 is round 1's first match's entry1,
 * position 2 that match's entry2, position 3 the next match's entry1, and so
 * on — the standard way a bracket sheet numbers its slots.
 */
function EntryPositionsList({
  eventId,
  entries,
  entryPositions,
  availablePositions,
}: {
  eventId: string;
  entries: DrawEvent["entries"];
  entryPositions: Map<string, number>;
  availablePositions: number[];
}) {
  return (
    <ul className="flex flex-col gap-2 print:hidden">
      {entries
        .slice()
        .sort((a, b) => entryDisplayName(a).localeCompare(entryDisplayName(b)))
        .map((entry) => {
          const currentPosition = entryPositions.get(entry.id) ?? null;
          return (
            <li
              key={entry.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border px-4 py-3"
            >
              <span className="text-sm font-medium text-text">{entryDisplayName(entry)}</span>
              <EntryPositionForm
                key={`${entry.id}:${currentPosition}`}
                eventId={eventId}
                entryId={entry.id}
                currentPosition={currentPosition}
                availablePositions={availablePositions}
              />
            </li>
          );
        })}
    </ul>
  );
}

/** Everything about one event's draw: generate, publish, adjust, and view it. */
export function EventDrawManager({
  event,
  tournamentName,
  slug,
}: {
  event: DrawEvent;
  tournamentName: string;
  slug: string;
}) {
  const confirmed = event.entries;

  // The "bracket portion" of the draw: every match for single elimination,
  // or just the knockout stage for pools+knockout (poolId null there; pool
  // matches always have one).
  const bracketPortionMatches = event.matches.filter((m) => m.poolId === null);
  // Each match is scored under its own stage's rules (see gameFormatForMatch).
  const formatFor = (m: { poolId: string | null }) => gameFormatForMatch(event, m);
  // showSchedule: false — a scheduled match's card would otherwise grow an
  // extra time/court line that an unscheduled one doesn't have, making cards
  // in the same round different heights. The Schedule page is where times
  // and courts actually get set and reviewed; the draw is just the bracket.
  const bracketMatches: BracketMatchView[] = bracketPortionMatches.map((m) =>
    toBracketMatchView(m, formatFor(m), { showSchedule: false }),
  );

  // A card opens the start-match popup only once there's actually something
  // to score: two known entries, no bye, no result yet, and the draw
  // published (the live-scoring action itself refuses an unpublished draw)
  // — otherwise it's a click to nowhere, so the card stays a plain summary.
  const scorableByMatchId = new Map(
    bracketPortionMatches
      .filter((m) => event.drawPublished && !m.isBye && m.entry1 !== null && m.entry2 !== null && m.status === null)
      .map((m) => [
        m.id,
        { liveHref: `/organizer/${slug}/matches/${m.id}`, scorable: toScorable(m, formatFor(m)) },
      ] as const),
  );
  const renderBracketMatch = (match: BracketMatchView) => {
    const info = scorableByMatchId.get(match.id);
    if (!info) return <MatchCard key={match.id} match={match} />;
    return (
      <StartMatchDialog key={match.id} liveHref={info.liveHref} scorable={info.scorable}>
        <MatchCard match={match} interactive />
      </StartMatchDialog>
    );
  };

  const unpublishWithId = unpublishDraw.bind(null, event.id);
  const publishWithId = publishDraw.bind(null, event.id);

  const swapCandidates = bracketPortionMatches
    .filter((m) => m.round === 1)
    .flatMap((m) => [m.entry1, m.entry2])
    .filter((e): e is NonNullable<typeof e> => e !== null)
    .map((e) => ({
      entryId: e.id,
      label: entryDisplayName(e),
    }));

  // Only an entry with a real round-1 opponent can be moved — moving one out
  // of the only slot in a bye "match" would leave that match empty on both
  // sides, so bye recipients aren't offered here.
  const round1ByeMatches = bracketPortionMatches.filter((m) => m.round === 1 && m.isBye);
  const moveToByeCandidates = bracketPortionMatches
    .filter((m) => m.round === 1 && !m.isBye)
    .flatMap((m) => [m.entry1, m.entry2])
    .filter((e): e is NonNullable<typeof e> => e !== null)
    .map((e) => ({ entryId: e.id, label: entryDisplayName(e) }));
  const byeSlots = round1ByeMatches.map((m) => {
    const occupant = m.entry1 ?? m.entry2;
    return { matchId: m.id, label: occupant ? `${entryDisplayName(occupant)}'s bye` : "Empty slot" };
  });

  // A manually-generated bracket starts with empty round-1 slots (see
  // generateManualDraw/generateManualKnockoutStage) — while any of them
  // aren't yet resolved (two entries, or a finalized bye), show the
  // entry-by-entry position picker below the (already-live) bracket preview,
  // instead of the normal publish/swap UI, which all assume round 1 is
  // already decided.
  const round1Matches = bracketPortionMatches.filter((m) => m.round === 1);
  const round1Resolved = round1Matches.length > 0 && round1Matches.every((m) => m.isBye || (m.entry1 !== null && m.entry2 !== null));

  // Position 2p+1 is match p's entry1, 2p+2 is its entry2 (p is 0-indexed) —
  // the usual way a bracket sheet numbers its slots top to bottom.
  const entryPositions = new Map<string, number>();
  for (const m of round1Matches) {
    if (m.entry1) entryPositions.set(m.entry1.id, m.position * 2 + 1);
    if (m.entry2) entryPositions.set(m.entry2.id, m.position * 2 + 2);
  }
  const takenPositions = new Set(entryPositions.values());
  const availablePositions = Array.from({ length: round1Matches.length * 2 }, (_, i) => i + 1).filter(
    (p) => !takenPositions.has(p),
  );

  // Round robin only: every match lives at round 1, no pools involved.
  const roundRobinStandings = event.drawFormat === "ROUND_ROBIN" ? standingsFor(confirmed, event.matches) : [];

  // Pools+knockout: each pool's own matches, standings, and completion state.
  const poolsView = event.pools.map((pool) => {
    const matches = event.matches.filter((m) => m.poolId === pool.id);
    return {
      id: pool.id,
      name: pool.name,
      entries: pool.entries,
      matches,
      standings: standingsFor(pool.entries, matches),
      complete: matches.length > 0 && matches.every((m) => m.winnerId !== null),
    };
  });
  const allPoolsComplete = poolsView.length > 0 && poolsView.every((p) => p.complete);
  const knockoutGenerated = bracketPortionMatches.length > 0;

  // The knockout stage's manual position picker offers only the
  // pool-standings advancers, not every confirmed entry — unlike single
  // elimination, not everyone is meant to reach this bracket, and
  // "everyone's placed" (which decides when a leftover slot becomes a bye)
  // has to mean everyone *eligible*, not everyone confirmed.
  const knockoutAdvancerIds =
    event.drawFormat === "POOLS_KNOCKOUT" && round1Matches.length > 0 && event.pools.length > 0
      ? (() => {
          const advancesPerPool = inferAdvancesPerPool(event.pools.length, round1Matches.length * 2);
          if (!advancesPerPool) return null;
          const poolStandings = poolsView.map((pool) =>
            computeRoundRobinStandings(
              pool.entries.map((e) => e.id),
              pool.matches.filter(
                (m): m is typeof m & { entry1Id: string; entry2Id: string } => m.entry1Id !== null && m.entry2Id !== null,
              ),
            ).map((s) => s.entryId),
          );
          return new Set(selectKnockoutAdvancers(poolStandings, advancesPerPool).map((a) => a.entryId));
        })()
      : null;
  const manualDrawEntries = knockoutAdvancerIds ? confirmed.filter((e) => knockoutAdvancerIds.has(e.id)) : confirmed;
  const poolSwapCandidates = poolsView.flatMap((pool) =>
    pool.entries.map((e) => ({ entryId: e.id, label: `${entryDisplayName(e)} (${pool.name})`, poolId: pool.id })),
  );

  return (
    <section
      id={`draw-${event.id}`}
      className="flex scroll-mt-4 flex-col gap-4 rounded-lg border border-border p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">{event.name}</h2>
          <p className="text-sm text-muted">
            {drawFormatLabels[event.drawFormat]} · {describeEventGameFormats(event)} · {confirmed.length}{" "}
            {confirmed.length === 1 ? "entry" : "entries"}
          </p>
        </div>
        {event.drawPublished ? (
          <span className="rounded-full bg-success/15 px-3 py-1 text-xs font-medium text-success">
            Published
          </span>
        ) : (
          <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-medium text-muted">
            Not published
          </span>
        )}
      </div>

        {event.drawFormat === "SINGLE_ELIMINATION" && (
          <>
            {bracketMatches.length === 0 ? (
              <p className="text-sm text-muted">
                No draw yet. Set seeds on the Manage entries tab if you like, then generate the draw once your
                confirmed entries are set (4–64 required).
              </p>
            ) : (
              <>
                <div id={`print-draw-${event.id}`}>
                  <div className="hidden print:block print:mb-4">
                    <h1 className="text-xl font-semibold">
                      {tournamentName} — {event.name}
                    </h1>
                    <p className="text-sm text-muted">
                      Draw format: {drawFormatLabels[event.drawFormat]}
                    </p>
                  </div>
                  <Bracket matches={bracketMatches} renderMatch={renderBracketMatch} />
                </div>
                {!round1Resolved && (
                  <div className="flex flex-col gap-2 print:hidden">
                    <h3 className="text-sm font-semibold text-text">Assign positions</h3>
                    <p className="text-sm text-muted">
                      Pick a position (1–{round1Matches.length * 2}) for each entry — the bracket above updates as
                      you go. Whichever positions are left empty once everyone&apos;s placed become byes automatically.
                    </p>
                    <EntryPositionsList
                      eventId={event.id}
                      entries={manualDrawEntries}
                      entryPositions={entryPositions}
                      availablePositions={availablePositions}
                    />
                  </div>
                )}
              </>
            )}

            <div className="flex flex-wrap items-center gap-3 print:hidden">
              {!event.drawPublished && (
                <>
                  <GenerateDrawForm eventId={event.id} hasExistingDraw={bracketMatches.length > 0} />
                  <GenerateManualDrawForm eventId={event.id} hasExistingDraw={bracketMatches.length > 0} />
                </>
              )}
              {bracketMatches.length > 0 && round1Resolved && !event.drawPublished && (
                <ActionForm
                  action={publishWithId}
                  variant="primary"
                  label="Publish draw"
                  pendingLabel="Publishing…"
                  confirmMessage="Publish this draw? Players will be able to see it, and it can no longer be regenerated."
                />
              )}
              {event.drawPublished && (
                <ActionForm
                  action={unpublishWithId}
                  variant="secondary"
                  label="Unpublish"
                  pendingLabel="Unpublishing…"
                  confirmMessage="Unpublish this draw so you can make changes and regenerate it?"
                />
              )}
              {bracketMatches.length > 0 && round1Resolved && <PrintDrawButton targetId={`print-draw-${event.id}`} />}
            </div>

            {round1Resolved && swapCandidates.length >= 2 && (
              <div className="flex flex-col gap-2 print:hidden">
                <h3 className="text-sm font-semibold text-text">
                  Swap two entries
                </h3>
                <p className="text-sm text-muted">
                  Fixes a placement without regenerating the whole draw. Only round-1 slots can be
                  swapped.
                </p>
                <SwapEntriesForm
                  eventId={event.id}
                  candidates={swapCandidates}
                  isPublished={event.drawPublished}
                />
              </div>
            )}

            {round1Resolved && byeSlots.length > 0 && moveToByeCandidates.length > 0 && (
              <div className="flex flex-col gap-2 print:hidden">
                <h3 className="text-sm font-semibold text-text">Move an entry to an empty slot</h3>
                <p className="text-sm text-muted">
                  Hands that entry the bye outright; its current opponent takes over its old slot instead.
                </p>
                <MoveEntryToByeForm
                  eventId={event.id}
                  candidates={moveToByeCandidates}
                  byeSlots={byeSlots}
                  isPublished={event.drawPublished}
                />
              </div>
            )}
          </>
        )}

        {event.drawFormat === "ROUND_ROBIN" && (
          <>
            {event.matches.length === 0 ? (
              <p className="text-sm text-muted">
                No draw yet. Generate the draw once your confirmed entries are set (3+ required).
              </p>
            ) : (
              <StandingsTable rows={roundRobinStandings} />
            )}

            <div className="flex flex-wrap items-center gap-3">
              {!event.drawPublished && (
                <GenerateDrawForm eventId={event.id} hasExistingDraw={event.matches.length > 0} />
              )}
              {event.matches.length > 0 && !event.drawPublished && (
                <ActionForm
                  action={publishWithId}
                  variant="primary"
                  label="Publish draw"
                  pendingLabel="Publishing…"
                  confirmMessage="Publish this draw? Players will be able to see it, and it can no longer be regenerated."
                />
              )}
              {event.drawPublished && (
                <ActionForm
                  action={unpublishWithId}
                  variant="secondary"
                  label="Unpublish"
                  pendingLabel="Unpublishing…"
                  confirmMessage="Unpublish this draw so you can make changes and regenerate it?"
                />
              )}
            </div>
          </>
        )}

        {event.drawFormat === "POOLS_KNOCKOUT" && (
          <>
            {poolsView.length === 0 ? (
              <p className="text-sm text-muted">
                No pools yet. Generate the draw once your confirmed entries are set (3+ required) —
                pools of 3-5 are formed automatically.
              </p>
            ) : (
              <div className="flex flex-col gap-6">
                {poolsView.map((pool) => (
                  <div key={pool.id} className="flex flex-col gap-2">
                    <h3 className="text-sm font-semibold text-text">
                      {pool.name} {pool.complete && "— complete"}
                    </h3>
                    <StandingsTable rows={pool.standings} />
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
              {!event.drawPublished && (
                <GenerateDrawForm eventId={event.id} hasExistingDraw={poolsView.length > 0} />
              )}
              {poolsView.length > 0 && !event.drawPublished && (
                <ActionForm
                  action={publishWithId}
                  variant="primary"
                  label="Publish draw"
                  pendingLabel="Publishing…"
                  confirmMessage="Publish the pools? Players will be able to see them, and pool assignments can no longer be regenerated."
                />
              )}
              {event.drawPublished && !knockoutGenerated && (
                <ActionForm
                  action={unpublishWithId}
                  variant="secondary"
                  label="Unpublish"
                  pendingLabel="Unpublishing…"
                  confirmMessage="Unpublish so you can make changes and regenerate the pools?"
                />
              )}
            </div>

            {poolSwapCandidates.length >= 2 && !knockoutGenerated && (
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold text-text">
                  Swap two entries between pools
                </h3>
                <p className="text-sm text-muted">
                  Fixes a pool assignment without regenerating everything.
                </p>
                <SwapPoolEntriesForm
                  eventId={event.id}
                  candidates={poolSwapCandidates}
                  isPublished={event.drawPublished}
                />
              </div>
            )}

            {poolSwapCandidates.length > 0 && poolsView.length >= 2 && !knockoutGenerated && (
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold text-text">
                  Move an entry to a different pool
                </h3>
                <p className="text-sm text-muted">
                  For when pools need to end up an uneven size instead of a like-for-like swap.
                </p>
                <MovePoolEntryForm
                  eventId={event.id}
                  candidates={poolSwapCandidates}
                  pools={poolsView.map((p) => ({ poolId: p.id, name: p.name }))}
                  isPublished={event.drawPublished}
                />
              </div>
            )}

            {poolsView.length > 0 && !knockoutGenerated && (
              <div className="flex flex-col gap-2 border-t border-border pt-4">
                <h3 className="text-sm font-semibold text-text">
                  Knockout stage
                </h3>
                {allPoolsComplete ? (
                  <div className="flex flex-wrap items-start gap-3">
                    <GenerateKnockoutForm eventId={event.id} />
                    <GenerateManualKnockoutForm eventId={event.id} />
                  </div>
                ) : (
                  <p className="text-sm text-muted">
                    Finish every pool match before generating the knockout stage.
                  </p>
                )}
              </div>
            )}

            {knockoutGenerated && (
              <div className="flex flex-col gap-4 border-t border-border pt-4">
                <h3 className="text-sm font-semibold text-text">
                  Knockout stage
                </h3>
                <div id={`print-knockout-${event.id}`}>
                  <div className="hidden print:block print:mb-4">
                    <h1 className="text-xl font-semibold">
                      {tournamentName} — {event.name}
                    </h1>
                  </div>
                  <Bracket matches={bracketMatches} renderMatch={renderBracketMatch} />
                </div>
                {!round1Resolved ? (
                  <div className="flex flex-col gap-2 print:hidden">
                    <h4 className="text-sm font-semibold text-text">Assign positions</h4>
                    <p className="text-sm text-muted">
                      Pick a position (1–{round1Matches.length * 2}) for each entry — the bracket above updates as
                      you go. Whichever positions are left empty once everyone&apos;s placed become byes automatically.
                    </p>
                    <EntryPositionsList
                      eventId={event.id}
                      entries={manualDrawEntries}
                      entryPositions={entryPositions}
                      availablePositions={availablePositions}
                    />
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center gap-3 print:hidden">
                      <PrintDrawButton targetId={`print-knockout-${event.id}`} />
                    </div>
                    {swapCandidates.length >= 2 && (
                      <div className="flex flex-col gap-2 print:hidden">
                        <h4 className="text-sm font-semibold text-text">
                          Swap two knockout entries
                        </h4>
                        <SwapEntriesForm
                          eventId={event.id}
                          candidates={swapCandidates}
                          isPublished={event.drawPublished}
                        />
                      </div>
                    )}
                    {byeSlots.length > 0 && moveToByeCandidates.length > 0 && (
                      <div className="flex flex-col gap-2 print:hidden">
                        <h4 className="text-sm font-semibold text-text">Move an entry to an empty slot</h4>
                        <p className="text-sm text-muted">
                          Hands that entry the bye outright; its current opponent takes over its old slot instead.
                        </p>
                        <MoveEntryToByeForm
                          eventId={event.id}
                          candidates={moveToByeCandidates}
                          byeSlots={byeSlots}
                          isPublished={event.drawPublished}
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </>
        )}
    </section>
  );
}
