"use server";

import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { revalidateTournament } from "@/lib/revalidate";
import { resolvePlayerSlot } from "@/app/actions/entries";

export type TeamActionState = { error?: string };

async function requireTeamEventForOrganizer(eventId: string, userId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { tournament: true },
  });
  if (!event || event.tournament.organizerId !== userId || event.category !== "TEAM") {
    redirect("/organizer");
  }
  return event;
}

export async function createTeam(
  eventId: string,
  _prevState: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  const userId = await requireUserId();
  const event = await requireTeamEventForOrganizer(eventId, userId);

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Enter a team name." };

  try {
    // The shim Entry lets team-vs-team draws reuse the individual-event
    // generators unchanged (a Team IS an Entry, as far as they're concerned).
    await prisma.$transaction(async (tx) => {
      const entry = await tx.entry.create({ data: { eventId, status: "CONFIRMED" } });
      await tx.team.create({ data: { eventId, name, entryId: entry.id } });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "A team with that name already exists in this event." };
    }
    throw error;
  }

  revalidateTournament(event.tournament.slug);
  return {};
}

export async function removeTeam(teamId: string): Promise<void> {
  const userId = await requireUserId();

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: { event: { include: { tournament: true } } },
  });
  if (!team || team.event.tournament.organizerId !== userId) redirect("/organizer");
  if (team.event.drawPublished) {
    throw new Error("Can't remove this team — the draw has already been published.");
  }

  // Mirrors withdrawEntry: a team already placed in a (still-draft) draw
  // would leave a Tie pointing at a deleted Entry, so clear the draft.
  const inDraftDraw = team.entryId
    ? await prisma.tie.count({
        where: { eventId: team.eventId, OR: [{ team1Id: team.entryId }, { team2Id: team.entryId }] },
      })
    : 0;
  if (inDraftDraw > 0) {
    await prisma.tie.deleteMany({ where: { eventId: team.eventId } });
  }

  await prisma.$transaction([
    prisma.team.delete({ where: { id: teamId } }),
    ...(team.entryId ? [prisma.entry.delete({ where: { id: team.entryId } })] : []),
  ]);

  revalidateTournament(team.event.tournament.slug);
}

export async function addTeamMember(
  teamId: string,
  _prevState: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  const userId = await requireUserId();

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: { event: { include: { tournament: true } } },
  });
  if (!team || team.event.tournament.organizerId !== userId) redirect("/organizer");

  const resolved = await resolvePlayerSlot(
    String(formData.get("name") ?? ""),
    String(formData.get("email") ?? ""),
  );
  if (!resolved.ok) return { error: resolved.error };

  if (resolved.userId) {
    const existing = await prisma.teamMember.findFirst({
      where: { userId: resolved.userId, team: { eventId: team.eventId } },
      include: { team: true },
    });
    if (existing) {
      return {
        error:
          existing.teamId === teamId
            ? "That player is already on this team."
            : `That player is already on "${existing.team.name}".`,
      };
    }
  }

  await prisma.teamMember.create({
    data: { teamId, userId: resolved.userId, guestName: resolved.guestName },
  });

  revalidateTournament(team.event.tournament.slug);
  return {};
}

export async function removeTeamMember(memberId: string): Promise<void> {
  const userId = await requireUserId();

  const member = await prisma.teamMember.findUnique({
    where: { id: memberId },
    include: { team: { include: { event: { include: { tournament: true } } } } },
  });
  if (!member || member.team.event.tournament.organizerId !== userId) redirect("/organizer");

  await prisma.teamMember.delete({ where: { id: memberId } });
  revalidateTournament(member.team.event.tournament.slug);
}
