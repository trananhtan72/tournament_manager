"use server";

import { z } from "zod";
import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";

export type EventActionState = { error?: string };

const eventSchema = z.object({
  name: z.string().trim().min(1, "Enter an event name").max(100),
  category: z.enum(["SINGLES", "DOUBLES"], {
    error: "Choose a category",
  }),
  drawFormat: z.enum(
    ["SINGLE_ELIMINATION", "ROUND_ROBIN", "POOLS_KNOCKOUT"],
    { error: "Choose a draw format" },
  ),
});

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
    name: formData.get("name"),
    category: formData.get("category"),
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
      return { error: "This tournament already has an event with that name." };
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
    name: formData.get("name"),
    category: formData.get("category"),
    drawFormat: formData.get("drawFormat"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  if (parsed.data.category !== event.category) {
    const entryCount = await prisma.entry.count({ where: { eventId } });
    if (entryCount > 0) {
      return {
        error: `Can't change singles/doubles — this event already has ${entryCount} ${entryCount === 1 ? "entry" : "entries"}. Remove them first or create a new event instead.`,
      };
    }
  }

  if (parsed.data.drawFormat !== event.drawFormat) {
    const matchCount = await prisma.match.count({ where: { eventId } });
    if (matchCount > 0) {
      return {
        error: "Can't change the draw format — a draw has already been generated for this event.",
      };
    }
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
      return { error: "This tournament already has an event with that name." };
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
