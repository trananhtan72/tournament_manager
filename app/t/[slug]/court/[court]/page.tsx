import { notFound } from "next/navigation";
import type { Metadata, Viewport } from "next";
import { prisma } from "@/lib/prisma";
import { entryDisplayName } from "@/lib/playerDisplay";
import { gameFormatForMatch } from "@/lib/tournament/gameFormat";
import { courtName } from "@/lib/tournament/courts";
import { pickCourtDisplay } from "@/lib/tournament/courtDisplay";
import { formatDayHeading, formatTimeOfDay, knockoutRoundCount, stageLabel } from "@/lib/tournament/schedule";
import { isLiveMatch, loadLiveStates } from "@/lib/liveMatches";
import { CourtDisplayShell } from "@/app/t/[slug]/court/[court]/CourtDisplayShell";
import { CourtScoreboard, CourtWaiting, type Board } from "@/app/t/[slug]/court/[court]/CourtScoreboard";

export const viewport: Viewport = { themeColor: "#000000" };

function parseCourt(value: string): number | null {
  if (!/^\d{1,2}$/.test(value)) return null;
  const courtNumber = Number(value);
  return courtNumber >= 1 ? courtNumber : null;
}

export async function generateMetadata({ params }: PageProps<"/t/[slug]/court/[court]">): Promise<Metadata> {
  const { slug, court } = await params;
  const courtNumber = parseCourt(court);
  const tournament = await prisma.tournament.findUnique({ where: { slug }, select: { name: true } });
  if (!tournament || courtNumber === null) return { title: "Court not found" };
  return {
    title: `Court ${courtNumber} — ${tournament.name}`,
    robots: { index: false },
    // Lets an iPad "Add to Home Screen" launch this as a full-screen app.
    appleWebApp: { capable: true, title: `Court ${courtNumber}`, statusBarStyle: "black-translucent" },
  };
}

export default async function CourtDisplayPage({ params }: PageProps<"/t/[slug]/court/[court]">) {
  const { slug, court } = await params;
  const courtNumber = parseCourt(court);
  if (courtNumber === null) notFound();

  const tournament = await prisma.tournament.findUnique({ where: { slug }, select: { id: true, name: true } });
  if (!tournament) notFound();

  const matches = await prisma.match.findMany({
    where: {
      isBye: false,
      court: { equals: courtName(courtNumber), mode: "insensitive" },
      event: { tournamentId: tournament.id, drawPublished: true },
    },
    include: {
      pool: true,
      event: { include: { matches: { select: { poolId: true, round: true } } } },
      entry1: { include: { players: { include: { user: true } } } },
      entry2: { include: { players: { include: { user: true } } } },
      winner: { select: { id: true } },
      games: { orderBy: { gameNumber: "asc" } },
    },
  });

  const liveStates = await loadLiveStates(matches, (m) => gameFormatForMatch(m.event, m));
  const choice = pickCourtDisplay(matches, new Date());
  const anyLive = matches.some(isLiveMatch);

  const eventLineFor = (m: (typeof matches)[number]) =>
    `${m.event.name} · ${stageLabel(
      { poolName: m.pool?.name ?? null, round: m.round },
      { drawFormat: m.event.drawFormat, knockoutRounds: knockoutRoundCount(m.event.matches) },
    )}`;
  const namesOf = (m: (typeof matches)[number]): [string, string] => [
    m.entry1 ? entryDisplayName(m.entry1) : "TBD",
    m.entry2 ? entryDisplayName(m.entry2) : "TBD",
  ];

  let content: React.ReactNode;
  if (choice.kind === "live" || choice.kind === "final") {
    const m = choice.match;
    const names = namesOf(m);
    let board: Board;
    const live = liveStates.get(m.id);
    if (choice.kind === "live" && live) {
      const flagSides = live.matchPoint.length > 0 ? live.matchPoint : live.gamePoint;
      board = {
        mode: "live",
        names,
        games: live.games.map((g) => ({ score1: g.score1, score2: g.score2 })),
        currentIndex: live.currentGame - 1,
        serving: live.server,
        flag: flagSides.length
          ? `${live.matchPoint.length > 0 ? "Match point" : "Game point"} — ${flagSides.map((s) => names[s - 1]).join(" / ")}`
          : null,
        winnerSide: null,
        note: null,
      };
    } else {
      const games = m.games.map((g) => ({ score1: g.entry1Score, score2: g.entry2Score }));
      board = {
        mode: "final",
        names,
        games,
        currentIndex: null,
        serving: null,
        flag: null,
        winnerSide: m.winnerId === m.entry1?.id ? 1 : m.winnerId === m.entry2?.id ? 2 : null,
        note: m.status === "WALKOVER" ? "Walkover" : m.status === "RETIRED" ? "Retired" : null,
      };
    }
    content = (
      <CourtScoreboard board={board} courtNumber={courtNumber} tournamentName={tournament.name} eventLine={eventLineFor(m)} />
    );
  } else {
    const next = choice.kind === "next" ? choice.match : null;
    content = (
      <CourtWaiting
        courtNumber={courtNumber}
        tournamentName={tournament.name}
        next={
          next && next.scheduledAt
            ? {
                names: namesOf(next),
                eventLine: eventLineFor(next),
                when: `${formatDayHeading(next.scheduledAt)}, ${formatTimeOfDay(next.scheduledAt)}`,
              }
            : null
        }
      />
    );
  }

  return <CourtDisplayShell refreshMs={anyLive ? 2500 : 8000}>{content}</CourtDisplayShell>;
}
