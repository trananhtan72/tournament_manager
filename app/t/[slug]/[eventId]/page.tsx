import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { drawFormatLabels } from "@/lib/eventLabels";
import { entryLabel, entryDisplayName } from "@/lib/playerDisplay";
import { computeRoundRobinStandings } from "@/lib/tournament/roundRobin";
import { Bracket, MatchCard, type BracketMatchView } from "@/components/Bracket";
import { StandingsTable, type StandingsRowView } from "@/components/StandingsTable";

type EntryWithPlayers = {
  id: string;
  seed: number | null;
  players: { guestName: string | null; user: { name: string; email: string } | null }[];
};

type MatchWithRelations = {
  id: string;
  poolId: string | null;
  round: number;
  position: number;
  isBye: boolean;
  status: "COMPLETED" | "WALKOVER" | "RETIRED" | null;
  winnerId: string | null;
  entry1: EntryWithPlayers | null;
  entry2: EntryWithPlayers | null;
  winner: EntryWithPlayers | null;
  games: { entry1Score: number; entry2Score: number }[];
};

function toBracketMatchView(m: MatchWithRelations): BracketMatchView {
  return {
    id: m.id,
    round: m.round,
    position: m.position,
    entry1Label: m.entry1 ? entryLabel(m.entry1) : null,
    entry1Seed: m.entry1?.seed ?? null,
    entry2Label: m.entry2 ? entryLabel(m.entry2) : null,
    entry2Seed: m.entry2?.seed ?? null,
    winnerLabel: m.winner ? entryLabel(m.winner) : null,
    isBye: m.isBye,
    status: m.status,
    games: m.games,
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

function MatchList({ title, matches }: { title: string; matches: MatchWithRelations[] }) {
  if (matches.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{title}</h3>
      <div className="flex flex-wrap gap-3">
        {matches.map((m) => (
          <MatchCard
            key={m.id}
            match={{
              id: m.id,
              round: m.round,
              position: m.position,
              entry1Label: m.entry1 ? entryDisplayName(m.entry1) : null,
              entry1Seed: null,
              entry2Label: m.entry2 ? entryDisplayName(m.entry2) : null,
              entry2Seed: null,
              winnerLabel: m.winner ? entryDisplayName(m.winner) : null,
              isBye: m.isBye,
              status: m.status,
              games: m.games,
            }}
          />
        ))}
      </div>
    </div>
  );
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
  const bracketMatches: BracketMatchView[] = bracketPortionMatches.map(toBracketMatchView);

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
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/t/${slug}`} className="text-sm underline">
          ← {event.tournament.name}
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-semibold">{event.name}</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Draw format: {drawFormatLabels[event.drawFormat]}
        </p>
      </div>

      {!event.drawPublished || !hasDrawContent ? (
        <p className="text-sm text-slate-500">The draw hasn&apos;t been published yet.</p>
      ) : event.drawFormat === "SINGLE_ELIMINATION" ? (
        <Bracket matches={bracketMatches} />
      ) : event.drawFormat === "ROUND_ROBIN" ? (
        <div className="flex flex-col gap-6">
          <StandingsTable rows={roundRobinStandings} />
          <MatchList title="Matches" matches={event.matches} />
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {poolsView.map((pool) => (
            <div key={pool.id} className="flex flex-col gap-3">
              <h2 className="text-lg font-semibold">{pool.name}</h2>
              <StandingsTable rows={pool.standings} highlightTopN={knockoutGenerated ? undefined : 2} />
              <MatchList title="Matches" matches={pool.matches} />
            </div>
          ))}
          {knockoutGenerated && (
            <div className="flex flex-col gap-3 border-t border-slate-200 pt-6 dark:border-slate-800">
              <h2 className="text-lg font-semibold">Knockout stage</h2>
              <Bracket matches={bracketMatches} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
