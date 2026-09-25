import type { BracketMatchView } from "@/components/Bracket";
import { entryLabel } from "@/lib/playerDisplay";
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
