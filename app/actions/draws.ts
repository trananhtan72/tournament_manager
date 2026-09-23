"use server";

import { z } from "zod";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { notify } from "@/lib/notify";
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

  const round1Matches = await prisma.match.findMany({
    where: { eventId, round: 1 },
    include: {
      entry1: { include: { players: true } },
      entry2: { include: { players: true } },
    },
  });
  if (round1Matches.length === 0) redirect(`/organizer/${event.tournament.slug}/${eventId}`);

  await prisma.event.update({ where: { id: eventId }, data: { drawPublished: true } });

  // Notify everyone actually placed in the bracket (not just "confirmed"
  // entries in general, in case one was added after the draw was generated
  // but before it was published).
  const notifiedUserIds = new Set<string>();
  for (const match of round1Matches) {
    for (const entry of [match.entry1, match.entry2]) {
      for (const player of entry?.players ?? []) {
        if (player.userId) notifiedUserIds.add(player.userId);
      }
    }
  }
  await Promise.all(
    [...notifiedUserIds].map((uid) =>
      notify(
        uid,
        `The draw for ${event.name} at ${event.tournament.name} has been published.`,
        `/t/${event.tournament.slug}/${eventId}`,
      ),
    ),
  );

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

type Round1Match = { id: string; position: number; entry1Id: string | null; entry2Id: string | null };

/**
 * Swaps two entries' positions in an already-generated round-1 draw, without
 * touching anyone else's slot. Recomputes each affected match's bye status
 * and, since no real match results exist before round 2, patches the round-2
 * slot(s) either match had already auto-advanced a bye winner into.
 */
export async function swapBracketEntries(
  eventId: string,
  _prevState: DrawActionState,
  formData: FormData,
): Promise<DrawActionState> {
  const userId = await requireUserId();
  const event = await requireOwnedEvent(eventId, userId);
  if (!event) return { error: "Event not found." };

  const entryIdA = formData.get("entryIdA");
  const entryIdB = formData.get("entryIdB");
  if (typeof entryIdA !== "string" || typeof entryIdB !== "string" || !entryIdA || !entryIdB) {
    return { error: "Select two entries to swap." };
  }
  if (entryIdA === entryIdB) {
    return { error: "Select two different entries to swap." };
  }

  const allMatches = await prisma.match.findMany({
    where: { eventId },
    select: { id: true, round: true, position: true, entry1Id: true, entry2Id: true, status: true },
  });
  const alreadyPlayed = allMatches.some(
    (m) => m.status !== null && (m.entry1Id === entryIdA || m.entry2Id === entryIdA || m.entry1Id === entryIdB || m.entry2Id === entryIdB),
  );
  if (alreadyPlayed) {
    return { error: "Can't swap — one of these entries has already played a scored match." };
  }

  const round1Matches: Round1Match[] = allMatches.filter((m) => m.round === 1);
  const matchA = round1Matches.find((m) => m.entry1Id === entryIdA || m.entry2Id === entryIdA);
  const matchB = round1Matches.find((m) => m.entry1Id === entryIdB || m.entry2Id === entryIdB);
  if (!matchA || !matchB) {
    return { error: "Both entries must currently be placed in the draw." };
  }

  const recompute = (entry1Id: string | null, entry2Id: string | null) => {
    const isBye = (entry1Id === null) !== (entry2Id === null);
    return { entry1Id, entry2Id, isBye, winnerId: isBye ? (entry1Id ?? entry2Id) : null };
  };

  if (matchA.id === matchB.id) {
    // Both entries are already in the same real match (a bye match only has
    // one entry, so this can't happen for a bye) — just flip their sides.
    await prisma.match.update({
      where: { id: matchA.id },
      data: { entry1Id: matchA.entry2Id, entry2Id: matchA.entry1Id },
    });
  } else {
    const finalA = recompute(
      matchA.entry1Id === entryIdA ? entryIdB : matchA.entry1Id,
      matchA.entry2Id === entryIdA ? entryIdB : matchA.entry2Id,
    );
    const finalB = recompute(
      matchB.entry1Id === entryIdB ? entryIdA : matchB.entry1Id,
      matchB.entry2Id === entryIdB ? entryIdA : matchB.entry2Id,
    );

    const round2PositionFor = (position: number) => Math.floor(position / 2);
    const round2SlotFor = (position: number): "entry1Id" | "entry2Id" =>
      position % 2 === 0 ? "entry1Id" : "entry2Id";

    const round2Matches = await prisma.match.findMany({
      where: {
        eventId,
        round: 2,
        position: { in: [...new Set([round2PositionFor(matchA.position), round2PositionFor(matchB.position)])] },
      },
      select: { id: true, position: true },
    });

    const round2Updates = new Map<string, { entry1Id?: string | null; entry2Id?: string | null }>();
    for (const [match, final] of [
      [matchA, finalA],
      [matchB, finalB],
    ] as const) {
      const r2Match = round2Matches.find((rm) => rm.position === round2PositionFor(match.position));
      if (!r2Match) continue;
      const slot = round2SlotFor(match.position);
      round2Updates.set(r2Match.id, {
        ...round2Updates.get(r2Match.id),
        [slot]: final.isBye ? final.winnerId : null,
      });
    }

    await prisma.$transaction([
      prisma.match.update({ where: { id: matchA.id }, data: finalA }),
      prisma.match.update({ where: { id: matchB.id }, data: finalB }),
      ...[...round2Updates.entries()].map(([id, data]) => prisma.match.update({ where: { id }, data })),
    ]);
  }

  revalidatePath(`/organizer/${event.tournament.slug}/${eventId}`);
  revalidatePath(`/t/${event.tournament.slug}/${eventId}`);
  return {};
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
