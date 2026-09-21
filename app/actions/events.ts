"use server";

import { z } from "zod";
import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export type EventActionState = { error?: string };

const eventSchema = z.object({
  type: z.enum(["MS", "WS", "MD", "WD", "XD"], {
    error: "Choose an event type",
  }),
  drawFormat: z.enum(
    ["SINGLE_ELIMINATION", "ROUND_ROBIN", "POOLS_KNOCKOUT"],
    { error: "Choose a draw format" },
  ),
});

async function requireUserId() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/signin");
  }
  return session.user.id;
}

async function requireOwnedTournament(tournamentId: string, userId: string) {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
  });
  if (!tournament || tournament.organizerId !== userId) {
    return null;
  }
  return tournament;
}

export async function createEvent(
  tournamentId: string,
  _prevState: EventActionState,
  formData: FormData,
): Promise<EventActionState> {
  const userId = await requireUserId();
  const tournament = await requireOwnedTournament(tournamentId, userId);
  if (!tournament) {
    return { error: "Tournament not found." };
  }

  const parsed = eventSchema.safeParse({
    type: formData.get("type"),
    drawFormat: formData.get("drawFormat"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    await prisma.event.create({
      data: { ...parsed.data, tournamentId },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { error: "This tournament already has that event." };
    }
    throw error;
  }

  revalidatePath(`/organizer/${tournament.slug}`);
  return {};
}

export async function updateEvent(
  eventId: string,
  _prevState: EventActionState,
  formData: FormData,
): Promise<EventActionState> {
  const userId = await requireUserId();

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { tournament: true },
  });
  if (!event || event.tournament.organizerId !== userId) {
    return { error: "Event not found." };
  }

  const parsed = eventSchema.safeParse({
    type: formData.get("type"),
    drawFormat: formData.get("drawFormat"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    await prisma.event.update({
      where: { id: eventId },
      data: parsed.data,
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { error: "This tournament already has that event." };
    }
    throw error;
  }

  revalidatePath(`/organizer/${event.tournament.slug}`);
  return {};
}

export async function deleteEvent(eventId: string): Promise<void> {
  const userId = await requireUserId();

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { tournament: true },
  });
  if (!event || event.tournament.organizerId !== userId) {
    redirect("/organizer");
  }

  await prisma.event.delete({ where: { id: eventId } });

  revalidatePath(`/organizer/${event.tournament.slug}`);
  redirect(`/organizer/${event.tournament.slug}`);
}
