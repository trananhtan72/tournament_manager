"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { revalidateTournament } from "@/lib/revalidate";
import { notify } from "@/lib/notify";
import { entryLabel } from "@/lib/playerDisplay";
import { isPlayerInMatch } from "@/lib/scoringAccess";
import { assignedMessage, refereeAddedMessage, refereeRemovedMessage, unassignedMessage } from "@/lib/refereeMessages";
import { formatScheduleLabel, knockoutRoundCount, stageLabel } from "@/lib/tournament/schedule";

export type RefereeActionState = { error?: string; saved?: boolean };

const EMAIL_CHOICE = "__email__";

async function ownedTournament(tournamentId: string, userId: string) {
  const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  return tournament && tournament.organizerId === userId ? tournament : null;
}

/** The person with this email as one of the tournament's referees, adding them to the list if they aren't on it. */
async function findOrAddReferee(tournamentId: string, rawEmail: string) {
  const parsed = z.email("Enter the referee's email address").safeParse(rawEmail.trim());
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Enter a valid email address" } as const;

  const user = await prisma.user.findFirst({ where: { email: { equals: parsed.data, mode: "insensitive" } } });
  if (!user) {
    return { error: "No account found with that email. They need to sign up first, then you can add them." } as const;
  }

  const existing = await prisma.tournamentReferee.findUnique({
    where: { tournamentId_userId: { tournamentId, userId: user.id } },
  });
  if (existing) return { referee: existing, user, created: false } as const;

  const referee = await prisma.tournamentReferee.create({ data: { tournamentId, userId: user.id } });
  return { referee, user, created: true } as const;
}

/** Adds a registered user to the tournament's referee list. */
export async function addReferee(
  tournamentId: string,
  _prevState: RefereeActionState,
  formData: FormData,
): Promise<RefereeActionState> {
  const userId = await requireUserId();
  const tournament = await ownedTournament(tournamentId, userId);
  if (!tournament) return { error: "Tournament not found." };

  const result = await findOrAddReferee(tournamentId, String(formData.get("email") ?? ""));
  if ("error" in result) return { error: result.error };
  if (!result.created) return { error: `${result.user.name} is already a referee for this tournament.` };

  await notify(result.user.id, refereeAddedMessage(tournament.name), "/referee");
  revalidateTournament(tournament.slug);
  return { saved: true };
}

/** Removes a referee; any matches assigned to them go back to having no referee. */
export async function removeReferee(
  refereeId: string,
  _prevState: RefereeActionState,
  _formData: FormData,
): Promise<RefereeActionState> {
  const userId = await requireUserId();
  const referee = await prisma.tournamentReferee.findUnique({
    where: { id: refereeId },
    include: { tournament: true, matches: { select: { status: true } } },
  });
  if (!referee || referee.tournament.organizerId !== userId) return { error: "Referee not found." };

  const pending = referee.matches.filter((m) => m.status === null).length;
  await prisma.tournamentReferee.delete({ where: { id: refereeId } }); // their matches are unassigned by the database
  await notify(referee.userId, refereeRemovedMessage(referee.tournament.name, pending), "/referee");
  revalidateTournament(referee.tournament.slug);
  return { saved: true };
}

/**
 * Assigns a match's referee: one picked from the tournament's list, or
 * someone entered by email (who is added to the list), or nobody. The
 * referee is told, and so is the one they replace.
 */
export async function assignReferee(
  matchId: string,
  _prevState: RefereeActionState,
  formData: FormData,
): Promise<RefereeActionState> {
  const userId = await requireUserId();

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      pool: true,
      referee: { include: { user: { select: { id: true, name: true } } } },
      event: { include: { tournament: true, matches: { select: { poolId: true, round: true } } } },
      entry1: { include: { players: { include: { user: true } } } },
      entry2: { include: { players: { include: { user: true } } } },
    },
  });
  if (!match || match.event.tournament.organizerId !== userId) return { error: "Match not found." };
  const tournament = match.event.tournament;
  if (match.isBye) return { error: "A bye isn't played, so it has no referee." };
  if (match.status !== null) return { error: "This match already has a result." };

  const choice = String(formData.get("referee") ?? "");
  let target: { id: string; userId: string } | null = null;

  if (choice === EMAIL_CHOICE) {
    const found = await findOrAddReferee(tournament.id, String(formData.get("email") ?? ""));
    if ("error" in found) return { error: found.error };
    target = { id: found.referee.id, userId: found.user.id };
  } else if (choice !== "") {
    const picked = await prisma.tournamentReferee.findFirst({ where: { id: choice, tournamentId: tournament.id } });
    if (!picked) return { error: "Choose a referee from the list." };
    target = { id: picked.id, userId: picked.userId };
  }

  if (target) {
    const playerUserIds = [match.entry1, match.entry2].flatMap((e) => e?.players.map((p) => p.userId) ?? []);
    if (isPlayerInMatch(target.userId, playerUserIds)) {
      return { error: "That person is playing in this match, so they can't referee it." };
    }
  }

  const previous = match.referee;
  if ((previous?.id ?? null) === (target?.id ?? null)) return { saved: true };

  await prisma.match.update({ where: { id: matchId }, data: { refereeId: target?.id ?? null } });

  const description = {
    players: [match.entry1 ? entryLabel(match.entry1) : "TBD", match.entry2 ? entryLabel(match.entry2) : "TBD"] as [string, string],
    eventName: match.event.name,
    stage: stageLabel(
      { poolName: match.pool?.name ?? null, round: match.round },
      { drawFormat: match.event.drawFormat, knockoutRounds: knockoutRoundCount(match.event.matches) },
    ),
    tournamentName: tournament.name,
    scheduleLabel: formatScheduleLabel(match),
  };
  if (previous) await notify(previous.userId, unassignedMessage(description), "/referee");
  if (target) await notify(target.userId, assignedMessage(description), `/referee/matches/${matchId}`);

  revalidateTournament(tournament.slug);
  return { saved: true };
}
