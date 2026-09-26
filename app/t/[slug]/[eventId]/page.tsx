import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { drawFormatLabels } from "@/lib/eventLabels";
import { gameFormatForMatch, describeEventGameFormats, type GameFormat } from "@/lib/tournament/gameFormat";
import { Bracket, MatchCard, type BracketMatchView } from "@/components/Bracket";
import { standingsFor, toBracketMatchView, type MatchWithRelations } from "@/lib/matchView";
import { StandingsTable } from "@/components/StandingsTable";
import { AutoRefresh } from "@/components/AutoRefresh";
import { isLiveMatch, loadLiveStates } from "@/lib/liveMatches";
import { tournamentPhase } from "@/lib/tournamentPhase";
import type { LiveState } from "@/lib/tournament/liveScoring";

function MatchList({
  title,
  matches,
  formatFor,
  liveStates,
}: {
  title: string;
  matches: MatchWithRelations[];
  formatFor: (m: MatchWithRelations) => GameFormat;
  liveStates: Map<string, LiveState>;
}) {
  if (matches.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-text">{title}</h3>
      <div className="flex flex-wrap gap-3">
        {matches.map((m) => (
          <MatchCard key={m.id} match={toBracketMatchView(m, formatFor(m), { live: liveStates.get(m.id) ?? null })} />
        ))}
      </div>
    </div>
  );
}

export async function generateMetadata({ params }: PageProps<"/t/[slug]/[eventId]">): Promise<Metadata> {
  const { slug, eventId } = await params;
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { name: true, tournament: { select: { name: true, slug: true } } },
  });
  if (!event || event.tournament.slug !== slug) return { title: "Event not found" };
  return { title: `${event.name} — ${event.tournament.name}` };
}

export default async function PublicEventPage({
  params,
}: PageProps<"/t/[slug]/[eventId]">) {
  const { slug, eventId } = await params;

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      tournament: true,
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
    },
  });

  if (!event || event.tournament.slug !== slug) notFound();

  const bracketPortionMatches = event.matches.filter((m) => m.poolId === null);
  const formatFor = (m: { poolId: string | null }) => gameFormatForMatch(event, m);
  // Live scores are only public once the draw is.
  const liveStates = event.drawPublished
    ? await loadLiveStates(event.matches, formatFor)
    : new Map<string, LiveState>();
  const bracketMatches: BracketMatchView[] = bracketPortionMatches.map((m) =>
    toBracketMatchView(m, formatFor(m), { live: liveStates.get(m.id) ?? null }),
  );
  const anyLive = event.matches.some(isLiveMatch);
  const refreshMs = anyLive ? 6000 : tournamentPhase(event.tournament.startDate, event.tournament.endDate) === "ongoing" ? 30000 : null;

  const roundRobinStandings = event.drawFormat === "ROUND_ROBIN" ? standingsFor(event.entries, event.matches) : [];

  const poolsView = event.pools.map((pool) => {
    const matches = event.matches.filter((m) => m.poolId === pool.id);
    return {
      id: pool.id,
      name: pool.name,
      matches,
      standings: standingsFor(pool.entries, matches),
    };
  });
  const knockoutGenerated = bracketPortionMatches.length > 0;

  const hasDrawContent =
    event.drawFormat === "SINGLE_ELIMINATION"
      ? bracketMatches.length > 0
      : event.drawFormat === "ROUND_ROBIN"
        ? event.matches.length > 0
        : poolsView.length > 0;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <AutoRefresh intervalMs={event.drawPublished ? refreshMs : null} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href={`/t/${slug}`} className="text-sm underline">
          ← {event.tournament.name}
        </Link>
        <Link href={`/t/${slug}/matches`} className="text-sm underline">
          All matches →
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-semibold">{event.name}</h1>
        <p className="text-sm text-muted">
          Draw format: {drawFormatLabels[event.drawFormat]}
        </p>
        <p className="text-sm text-muted">
          Game format: {describeEventGameFormats(event)}
        </p>
      </div>

      {!event.drawPublished || !hasDrawContent ? (
        <p className="text-sm text-muted">The draw hasn&apos;t been published yet.</p>
      ) : event.drawFormat === "SINGLE_ELIMINATION" ? (
        <Bracket matches={bracketMatches} />
      ) : event.drawFormat === "ROUND_ROBIN" ? (
        <div className="flex flex-col gap-6">
          <StandingsTable rows={roundRobinStandings} />
          <MatchList title="Matches" matches={event.matches} formatFor={formatFor} liveStates={liveStates} />
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {poolsView.map((pool) => (
            <div key={pool.id} className="flex flex-col gap-3">
              <h2 className="text-lg font-semibold">{pool.name}</h2>
              <StandingsTable rows={pool.standings} highlightTopN={knockoutGenerated ? undefined : 2} />
              <MatchList title="Matches" matches={pool.matches} formatFor={formatFor} liveStates={liveStates} />
            </div>
          ))}
          {knockoutGenerated && (
            <div className="flex flex-col gap-3 border-t border-border pt-6">
              <h2 className="text-lg font-semibold">Knockout stage</h2>
              <Bracket matches={bracketMatches} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
