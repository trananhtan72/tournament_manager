import type { BracketMatchView } from "@/components/Bracket";
import type { StandingsRowView } from "@/components/StandingsTable";
import { entryDisplayName, entryLabel } from "@/lib/playerDisplay";
import { computeRoundRobinStandings } from "@/lib/tournament/roundRobin";
import { formatScheduleLabel } from "@/lib/tournament/schedule";
import type { GameFormat } from "@/lib/tournament/gameFormat";

export type EntryWithPlayers = {
  id: string;
  seed: number | null;
  players: { guestName: string | null; user: { name: string; email: string } | null }[];
};

export type MatchWithRelations = {
  id: string;
  poolId: string | null;
  round: number;
  position: number;
  isBye: boolean;
  status: "COMPLETED" | "WALKOVER" | "RETIRED" | null;
  winnerId: string | null;
  scheduledAt: Date | null;
  court: string | null;
  entry1: EntryWithPlayers | null;
  entry2: EntryWithPlayers | null;
  winner: EntryWithPlayers | null;
  games: { entry1Score: number; entry2Score: number }[];
};

/**
 * The data a MatchCard draws. Pass `showSchedule: false` where the surrounding
 * layout already shows the match's time and court (schedule and dashboard rows).
 */
export function toBracketMatchView(
  m: MatchWithRelations,
  format: GameFormat,
  { showSchedule = true }: { showSchedule?: boolean } = {},
): BracketMatchView {
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
    gamesPerMatch: format.gamesPerMatch,
    scheduleLabel: showSchedule ? formatScheduleLabel(m) : null,
  };
}

/** What MatchResultForm needs for a match with both entries known. */
export function toScorable(m: MatchWithRelations, format: GameFormat) {
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

export function standingsFor(entries: EntryWithPlayers[], matches: MatchWithRelations[]): StandingsRowView[] {
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
