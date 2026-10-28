"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { revalidateTournament } from "@/lib/revalidate";

export type TieActionState = { error?: string };

async function requireOwnedTie(tieId: string, userId: string) {
  const tie = await prisma.tie.findUnique({
    where: { id: tieId },
    include: {
      event: { include: { tournament: true, tieFormatSlots: { orderBy: { order: "asc" } } } },
      team1Entry: { include: { team: { include: { members: { include: { user: true } } } } } },
      team2Entry: { include: { team: { include: { members: { include: { user: true } } } } } },
      matches: true,
    },
  });
  if (!tie || tie.event.tournament.organizerId !== userId) {
    redirect("/organizer");
  }
  return tie;
}

function rubberPosition(tiePosition: number, slotOrder: number): number {
  return tiePosition * 100 + (slotOrder - 1);
}

/** The organizer (acting for whichever captain) picks who plays one slot for one side of a tie. */
export async function submitTieLineupSlot(
  tieId: string,
  slotOrder: number,
  side: 1 | 2,
  _prevState: TieActionState,
  formData: FormData,
): Promise<TieActionState> {
  const userId = await requireUserId();
  const tie = await requireOwnedTie(tieId, userId);

  const slot = tie.event.tieFormatSlots.find((s) => s.order === slotOrder);
  if (!slot) return { error: "That slot doesn't exist for this tie's format." };

  const teamEntry = side === 1 ? tie.team1Entry : tie.team2Entry;
  if (!teamEntry?.team) return { error: "That side of the tie doesn't have a team yet." };
  const roster = teamEntry.team.members;

  const neededPlayers = slot.type === "DOUBLES" ? 2 : 1;
  const memberIds = [String(formData.get("memberId1") ?? ""), String(formData.get("memberId2") ?? "")]
    .slice(0, neededPlayers)
    .filter(Boolean);
  if (memberIds.length !== neededPlayers) {
    return { error: `Pick ${neededPlayers === 1 ? "a player" : "2 players"} for this slot.` };
  }
  if (new Set(memberIds).size !== memberIds.length) {
    return { error: "Pick 2 different players." };
  }
  const members = memberIds.map((id) => roster.find((m) => m.id === id));
  if (members.some((m) => !m)) {
    return { error: "One of those players isn't on this team's roster." };
  }

  const position = rubberPosition(tie.position, slotOrder);
  const existingMatch = tie.matches.find((m) => m.position === position);
  const existingEntryId = existingMatch ? (side === 1 ? existingMatch.entry1Id : existingMatch.entry2Id) : null;
  if (existingMatch?.status !== null && existingMatch?.status !== undefined) {
    return { error: "This rubber already has a result — withdraw it first to change the lineup." };
  }

  await prisma.$transaction(async (tx) => {
    const entry = await tx.entry.create({
      data: {
        eventId: tie.eventId,
        status: "CONFIRMED",
        players: {
          create: members.map((m, i) => ({
            eventId: tie.eventId,
            userId: m!.userId,
            guestName: m!.guestName,
            role: i === 0 ? "INITIATOR" : "PARTNER",
            confirmed: true,
          })),
        },
      },
    });

    if (existingMatch) {
      await tx.match.update({
        where: { id: existingMatch.id },
        data: side === 1 ? { entry1Id: entry.id } : { entry2Id: entry.id },
      });
    } else {
      await tx.match.create({
        data: {
          eventId: tie.eventId,
          tieId: tie.id,
          tieSlotLabel: slot.label,
          round: tie.round,
          position,
          gamesPerMatch: slot.gamesPerMatch,
          pointsPerGame: slot.pointsPerGame,
          entry1Id: side === 1 ? entry.id : null,
          entry2Id: side === 2 ? entry.id : null,
        },
      });
    }

    if (existingEntryId) {
      await tx.entry.delete({ where: { id: existingEntryId } });
    }
  });

  revalidateTournament(tie.event.tournament.slug);
  return {};
}
