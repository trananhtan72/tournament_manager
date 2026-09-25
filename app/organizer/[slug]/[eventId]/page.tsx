import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { drawFormatLabels, isDoublesCategory } from "@/lib/eventLabels";
import { playerName as getPlayerName, entryDisplayName } from "@/lib/playerDisplay";
import { roundName } from "@/lib/tournament/singleElimination";
import { gameFormatForMatch, describeEventGameFormats, type GameFormat } from "@/lib/tournament/gameFormat";
import { computeRoundRobinStandings } from "@/lib/tournament/roundRobin";
import { ActionForm } from "@/components/ActionForm";
import { EntrySeedField } from "@/components/EntrySeedField";
import { RemoveEntryButton } from "@/components/RemoveEntryButton";
import { PendingEntryActions } from "@/components/PendingEntryActions";
import { EntryPlayersWithEmail } from "@/components/EntryPlayersWithEmail";
import { Bracket, type BracketMatchView } from "@/components/Bracket";
import { toBracketMatchView, type EntryWithPlayers, type MatchWithRelations } from "@/lib/matchView";
import { StandingsTable, type StandingsRowView } from "@/components/StandingsTable";
import { publishDraw, unpublishDraw } from "@/app/actions/draws";
import { PairEntriesForm } from "@/app/organizer/[slug]/[eventId]/PairEntriesForm";
import { QuickAddEntryForm } from "@/app/organizer/[slug]/[eventId]/QuickAddEntryForm";
import { GenerateDrawForm } from "@/app/organizer/[slug]/[eventId]/GenerateDrawForm";
import { GenerateKnockoutForm } from "@/app/organizer/[slug]/[eventId]/GenerateKnockoutForm";
import { SwapEntriesForm } from "@/app/organizer/[slug]/[eventId]/SwapEntriesForm";
import { SwapPoolEntriesForm } from "@/app/organizer/[slug]/[eventId]/SwapPoolEntriesForm";
import { MovePoolEntryForm } from "@/app/organizer/[slug]/[eventId]/MovePoolEntryForm";
import { MatchResultForm } from "@/app/organizer/[slug]/[eventId]/MatchResultForm";
import { PrintDrawButton } from "@/components/PrintDrawButton";

function toScorable(m: MatchWithRelations, format: GameFormat) {
  return {
    gamesPerMatch: format.gamesPerMatch,
    pointsPerGame: format.pointsPerGame,
    matchId: m.id,
    round: m.round,
    position: m.position,
    entry1Id: m.entry1!.id,
    entry1Label: entryDisplayName(m.entry1!),
    entry2Id: m.entry2!.id,
    entry2Label: entryDisplayName(m.entry2!),
    existing: {
      status: m.status,
      winnerId: m.winnerId,
      games: m.games,
    },
  };
}

function standingsFor(entries: EntryWithPlayers[], matches: MatchWithRelations[]): StandingsRowView[] {
  const standings = computeRoundRobinStandings(
    entries.map((e) => e.id),
    matches
      .filter((m): m is MatchWithRelations & { entry1: EntryWithPlayers; entry2: EntryWithPlayers } =>
        m.entry1 !== null && m.entry2 !== null,
      )
      .map((m) => ({ entry1Id: m.entry1.id, entry2Id: m.entry2.id, winnerId: m.winnerId, games: m.games })),
  );
  const byId = new Map(entries.map((e) => [e.id, e]));
  return standings.map((s) => ({ ...s, label: entryDisplayName(byId.get(s.entryId)!) }));
}

function MatchResultsList({
  title,
  matches,
}: {
  title: string;
  matches: ReturnType<typeof toScorable>[];
}) {
  if (matches.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{title}</h3>
      <ul className="flex flex-col gap-3">
        {matches.map((m) => (
          <li key={m.matchId}>
            <MatchResultForm
              key={`${m.matchId}:${m.existing.status}:${m.existing.winnerId}`}
              matchId={m.matchId}
              entry1Id={m.entry1Id}
              entry1Label={m.entry1Label}
              entry2Id={m.entry2Id}
              entry2Label={m.entry2Label}
              gamesPerMatch={m.gamesPerMatch}
              pointsPerGame={m.pointsPerGame}
              existing={m.existing}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function ManageEventPage({
  params,
}: PageProps<"/organizer/[slug]/[eventId]">) {
  const { slug, eventId } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    redirect("/signin");
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      tournament: true,
      entries: {
        include: { players: { include: { user: true } } },
        orderBy: { createdAt: "asc" },
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
    },
  });

  if (!event || event.tournament.slug !== slug || event.tournament.organizerId !== session.user.id) {
    notFound();
  }

  const pendingApproval = event.entries.filter((e) => e.status === "PENDING_APPROVAL");
  const confirmed = event.entries.filter((e) => e.status === "CONFIRMED");
  const pendingPartner = event.entries.filter((e) => e.status === "PENDING_PARTNER");
  const needsPartner = event.entries.filter((e) => e.status === "NEEDS_PARTNER");

  const pairCandidates = needsPartner.map((e) => ({
    entryId: e.id,
    playerName: e.players[0] ? getPlayerName(e.players[0]) : "Unknown",
  }));

  // The "bracket portion" of the draw: every match for single elimination,
  // or just the knockout stage for pools+knockout (poolId null there; pool
  // matches always have one).
  const bracketPortionMatches = event.matches.filter((m) => m.poolId === null);
  // Each match is scored under its own stage's rules (see gameFormatForMatch).
  const formatFor = (m: { poolId: string | null }) => gameFormatForMatch(event, m);
  const bracketMatches: BracketMatchView[] = bracketPortionMatches.map((m) => toBracketMatchView(m, formatFor(m)));
  const scorableBracketMatches = bracketPortionMatches
    .filter((m) => !m.isBye && m.entry1 && m.entry2)
    .map((m) => toScorable(m, formatFor(m)));
  const totalRounds = bracketMatches.reduce((max, m) => Math.max(max, m.round), 0);

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

  // Round robin only: every match lives at round 1, no pools involved.
  const roundRobinStandings = event.drawFormat === "ROUND_ROBIN" ? standingsFor(confirmed, event.matches) : [];
  const roundRobinScorable = event.drawFormat === "ROUND_ROBIN" ? event.matches.map((m) => toScorable(m, formatFor(m))) : [];

  // Pools+knockout: each pool's own matches, standings, and completion state.
  const poolsView = event.pools.map((pool) => {
    const matches = event.matches.filter((m) => m.poolId === pool.id);
    return {
      id: pool.id,
      name: pool.name,
      entries: pool.entries,
      matches,
      standings: standingsFor(pool.entries, matches),
      scorable: matches.map((m) => toScorable(m, formatFor(m))),
      complete: matches.length > 0 && matches.every((m) => m.winnerId !== null),
    };
  });
  const allPoolsComplete = poolsView.length > 0 && poolsView.every((p) => p.complete);
  const knockoutGenerated = bracketPortionMatches.length > 0;
  const poolSwapCandidates = poolsView.flatMap((pool) =>
    pool.entries.map((e) => ({ entryId: e.id, label: `${entryDisplayName(e)} (${pool.name})`, poolId: pool.id })),
  );

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href={`/organizer/${slug}`} className="text-sm underline">
          ← {event.tournament.name}
        </Link>
      </div>

      <div>
        <h1 className="text-xl font-semibold">{event.name}</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Draw format: {drawFormatLabels[event.drawFormat]}
        </p>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Game format: {describeEventGameFormats(event)}
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Pending approval ({pendingApproval.length})</h2>
        {pendingApproval.length === 0 ? (
          <p className="text-sm text-slate-500">No registrations waiting for approval.</p>
        ) : (
          <>
            <p className="text-sm text-slate-500">
              Players who registered themselves. Approve a registration to move it to the
              confirmed entries; only confirmed entries go into the draw.
            </p>
            <ul className="flex flex-col gap-2">
              {pendingApproval.map((entry) => (
                <li
                  key={entry.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-700 dark:bg-amber-950/40"
                >
                  <EntryPlayersWithEmail players={entry.players} />
                  <PendingEntryActions entryId={entry.id} />
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Confirmed entries ({confirmed.length})</h2>
        {confirmed.length === 0 ? (
          <p className="text-sm text-slate-500">No confirmed entries yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {confirmed.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 px-4 py-3 dark:border-slate-700"
              >
                <EntryPlayersWithEmail players={entry.players} />
                <div className="flex items-center gap-3">
                  <EntrySeedField
                    key={`${entry.id}:${entry.seed}`}
                    entryId={entry.id}
                    currentSeed={entry.seed}
                    disabled={event.drawPublished}
                  />
                  <RemoveEntryButton entryId={entry.id} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {pendingPartner.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">
            Awaiting partner confirmation ({pendingPartner.length})
          </h2>
          <ul className="flex flex-col gap-2">
            {pendingPartner.map((entry) => {
              const initiator = entry.players.find((p) => p.role === "INITIATOR");
              const partner = entry.players.find((p) => p.role === "PARTNER");
              return (
                <li
                  key={entry.id}
                  className="flex items-center justify-between rounded-md border border-slate-200 px-4 py-3 dark:border-slate-700"
                >
                  <span className="text-sm">
                    {initiator ? getPlayerName(initiator) : "Unknown"} → invited{" "}
                    {partner ? getPlayerName(partner) : "Unknown"} (unconfirmed)
                  </span>
                  <RemoveEntryButton entryId={entry.id} />
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Needs a partner ({needsPartner.length})</h2>
        {needsPartner.length === 0 ? (
          <p className="text-sm text-slate-500">No unpaired registrations.</p>
        ) : (
          <>
            <ul className="flex flex-col gap-2">
              {needsPartner.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center justify-between rounded-md border border-slate-200 px-4 py-3 dark:border-slate-700"
                >
                  <span className="text-sm">
                    {entry.players[0] ? getPlayerName(entry.players[0]) : "Unknown"}
                  </span>
                  <RemoveEntryButton entryId={entry.id} />
                </li>
              ))}
            </ul>
            {needsPartner.length >= 2 && (
              <PairEntriesForm eventId={event.id} candidates={pairCandidates} />
            )}
          </>
        )}
      </section>

      <section className="flex flex-col gap-3 border-t border-slate-200 pt-6 dark:border-slate-800">
        <h2 className="text-lg font-semibold">Quick add entry</h2>
        <p className="text-sm text-slate-500">
          For in-person or cash registrations. Leave email blank to add a player without an
          account.
        </p>
        <QuickAddEntryForm eventId={event.id} isDoubles={isDoublesCategory(event.category)} />
      </section>

      <section className="flex flex-col gap-4 border-t border-slate-200 pt-6 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Draw</h2>
          {event.drawPublished && (
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
              Published
            </span>
          )}
        </div>

        {event.drawFormat === "SINGLE_ELIMINATION" && (
          <>
            {bracketMatches.length === 0 ? (
              <p className="text-sm text-slate-500">
                No draw yet. Assign seeds above if you like, then generate the draw once your
                confirmed entries are set (4–64 required).
              </p>
            ) : (
              <div id="printable-draw">
                <div className="hidden print:block print:mb-4">
                  <h1 className="text-xl font-semibold">
                    {event.tournament.name} — {event.name}
                  </h1>
                  <p className="text-sm text-slate-600">
                    Draw format: {drawFormatLabels[event.drawFormat]}
                  </p>
                </div>
                <Bracket matches={bracketMatches} />
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 print:hidden">
              {!event.drawPublished && (
                <GenerateDrawForm eventId={event.id} hasExistingDraw={bracketMatches.length > 0} />
              )}
              {bracketMatches.length > 0 && !event.drawPublished && (
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
              {bracketMatches.length > 0 && <PrintDrawButton />}
            </div>

            {swapCandidates.length >= 2 && (
              <div className="flex flex-col gap-2 print:hidden">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Swap two entries
                </h3>
                <p className="text-sm text-slate-500">
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
          </>
        )}

        {event.drawFormat === "ROUND_ROBIN" && (
          <>
            {roundRobinScorable.length === 0 ? (
              <p className="text-sm text-slate-500">
                No draw yet. Generate the draw once your confirmed entries are set (3+ required).
              </p>
            ) : (
              <StandingsTable rows={roundRobinStandings} />
            )}

            <div className="flex flex-wrap items-center gap-3">
              {!event.drawPublished && (
                <GenerateDrawForm eventId={event.id} hasExistingDraw={roundRobinScorable.length > 0} />
              )}
              {roundRobinScorable.length > 0 && !event.drawPublished && (
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
              <p className="text-sm text-slate-500">
                No pools yet. Generate the draw once your confirmed entries are set (3+ required) —
                pools of 3-5 are formed automatically.
              </p>
            ) : (
              <div className="flex flex-col gap-6">
                {poolsView.map((pool) => (
                  <div key={pool.id} className="flex flex-col gap-2">
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
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
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Swap two entries between pools
                </h3>
                <p className="text-sm text-slate-500">
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
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Move an entry to a different pool
                </h3>
                <p className="text-sm text-slate-500">
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
              <div className="flex flex-col gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Knockout stage
                </h3>
                {allPoolsComplete ? (
                  <GenerateKnockoutForm eventId={event.id} />
                ) : (
                  <p className="text-sm text-slate-500">
                    Finish every pool match before generating the knockout stage.
                  </p>
                )}
              </div>
            )}

            {knockoutGenerated && (
              <div className="flex flex-col gap-4 border-t border-slate-200 pt-4 dark:border-slate-800">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Knockout stage
                </h3>
                <div id="printable-draw">
                  <div className="hidden print:block print:mb-4">
                    <h1 className="text-xl font-semibold">
                      {event.tournament.name} — {event.name}
                    </h1>
                  </div>
                  <Bracket matches={bracketMatches} />
                </div>
                <div className="flex flex-wrap items-center gap-3 print:hidden">
                  <PrintDrawButton />
                </div>
                {swapCandidates.length >= 2 && (
                  <div className="flex flex-col gap-2 print:hidden">
                    <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Swap two knockout entries
                    </h4>
                    <SwapEntriesForm
                      eventId={event.id}
                      candidates={swapCandidates}
                      isPublished={event.drawPublished}
                    />
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </section>

      {event.drawPublished && event.drawFormat === "SINGLE_ELIMINATION" && scorableBracketMatches.length > 0 && (
        <section className="flex flex-col gap-4 border-t border-slate-200 pt-6 dark:border-slate-800">
          <h2 className="text-lg font-semibold">Match results</h2>
          {Array.from({ length: totalRounds }, (_, i) => i + 1).map((round) => (
            <MatchResultsList
              key={round}
              title={roundName(round, totalRounds)}
              matches={scorableBracketMatches.filter((m) => m.round === round).sort((a, b) => a.position - b.position)}
            />
          ))}
        </section>
      )}

      {event.drawPublished && event.drawFormat === "ROUND_ROBIN" && roundRobinScorable.length > 0 && (
        <section className="flex flex-col gap-4 border-t border-slate-200 pt-6 dark:border-slate-800">
          <h2 className="text-lg font-semibold">Match results</h2>
          <MatchResultsList title="Matches" matches={roundRobinScorable} />
        </section>
      )}

      {event.drawPublished && event.drawFormat === "POOLS_KNOCKOUT" && poolsView.length > 0 && (
        <section className="flex flex-col gap-4 border-t border-slate-200 pt-6 dark:border-slate-800">
          <h2 className="text-lg font-semibold">Match results</h2>
          {poolsView.map((pool) => (
            <MatchResultsList key={pool.id} title={pool.name} matches={pool.scorable} />
          ))}
          {knockoutGenerated &&
            Array.from({ length: totalRounds }, (_, i) => i + 1).map((round) => (
              <MatchResultsList
                key={round}
                title={roundName(round, totalRounds)}
                matches={scorableBracketMatches.filter((m) => m.round === round).sort((a, b) => a.position - b.position)}
              />
            ))}
        </section>
      )}
    </div>
  );
}
