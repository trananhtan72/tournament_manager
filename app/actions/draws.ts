"use server";

import { z } from "zod";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import {
  generateSingleEliminationBracket,
  MIN_BRACKET_ENTRIES,
  MAX_BRACKET_ENTRIES,
  type SeededEntry,
} from "@/lib/tournament/singleElimination";

export type DrawActionState = { error?: string };

async function requireOwnedEvent(eventId: string, userId: string) {
  return prisma.event.findFirst({
    where: { id: eventId, tournament: { organizerId: userId } },
    include: { tournament: true },
  });
}

export async function generateDraw(
  eventId: string,
  _prevState: DrawActionState,
  _formData: FormData,
): Promise<DrawActionState> {
  const userId = await requireUserId();
  const event = await requireOwnedEvent(eventId, userId);
  if (!event) return { error: "Event not found." };
  if (event.drawPublished) {
    return { error: "The draw has already been published. Unpublish it first to regenerate." };
  }
  if (event.drawFormat !== "SINGLE_ELIMINATION") {
    return { error: "Only single-elimination draws can be generated right now." };
  }

  const confirmedEntries = await prisma.entry.findMany({
    where: { eventId, status: "CONFIRMED" },
    select: { id: true, seed: true },
  });

  if (confirmedEntries.length < MIN_BRACKET_ENTRIES) {
    return {
      error: `Need at least ${MIN_BRACKET_ENTRIES} confirmed entries to generate a draw (have ${confirmedEntries.length}).`,
    };
  }
  if (confirmedEntries.length > MAX_BRACKET_ENTRIES) {
    return {
      error: `Single elimination supports at most ${MAX_BRACKET_ENTRIES} entries (have ${confirmedEntries.length}).`,
    };
  }

  const seededEntries: SeededEntry[] = confirmedEntries.map((e) => ({
    entryId: e.id,
    seed: e.seed,
  }));

  let bracket;
  try {
    bracket = generateSingleEliminationBracket(seededEntries);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Couldn't generate the draw." };
  }

  await prisma.$transaction([
    prisma.match.deleteMany({ where: { eventId } }),
    prisma.match.createMany({
      data: bracket.map((m) => ({
        eventId,
        round: m.round,
        position: m.position,
        entry1Id: m.entry1Id,
        entry2Id: m.entry2Id,
        winnerId: m.winnerId,
        isBye: m.isBye,
      })),
    }),
  ]);

  revalidatePath(`/organizer/${event.tournament.slug}/${eventId}`);
  revalidatePath(`/t/${event.tournament.slug}/${eventId}`);
  return {};
}

export async function publishDraw(eventId: string): Promise<void> {
  const userId = await requireUserId();
  const event = await requireOwnedEvent(eventId, userId);
  if (!event) redirect("/organizer");

  const matchCount = await prisma.match.count({ where: { eventId } });
  if (matchCount === 0) redirect(`/organizer/${event.tournament.slug}/${eventId}`);

  await prisma.event.update({ where: { id: eventId }, data: { drawPublished: true } });

  revalidatePath(`/organizer/${event.tournament.slug}/${eventId}`);
  revalidatePath(`/t/${event.tournament.slug}/${eventId}`);
}

export async function unpublishDraw(eventId: string): Promise<void> {
  const userId = await requireUserId();
  const event = await requireOwnedEvent(eventId, userId);
  if (!event) redirect("/organizer");

  await prisma.event.update({ where: { id: eventId }, data: { drawPublished: false } });

  revalidatePath(`/organizer/${event.tournament.slug}/${eventId}`);
  revalidatePath(`/t/${event.tournament.slug}/${eventId}`);
}

const seedSchema = z.union([
  z.literal(""),
  z.coerce.number().int().min(1, "Seed must be 1-8").max(8, "Seed must be 1-8"),
]);

export async function setEntrySeed(
  entryId: string,
  _prevState: DrawActionState,
  formData: FormData,
): Promise<DrawActionState> {
  const userId = await requireUserId();

  const entry = await prisma.entry.findUnique({
    where: { id: entryId },
    include: { event: { include: { tournament: true } } },
  });
  if (!entry || entry.event.tournament.organizerId !== userId) {
    return { error: "Entry not found." };
  }
  if (entry.event.drawPublished) {
    return { error: "Can't change seeds after the draw is published." };
  }

  const parsed = seedSchema.safeParse(formData.get("seed"));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid seed" };
  }
  const seed = parsed.data === "" ? null : parsed.data;

  try {
    await prisma.entry.update({ where: { id: entryId }, data: { seed } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: `Seed ${seed} is already assigned to another entry in this event.` };
    }
    throw error;
  }

  revalidatePath(`/organizer/${entry.event.tournament.slug}/${entry.eventId}`);
  return {};
}
