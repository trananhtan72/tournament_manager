"use server";

import { z } from "zod";
import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { registrationIsOpen } from "@/lib/registrationDeadline";
import { isDoublesEventType } from "@/lib/eventLabels";

export type EntryActionState = { error?: string };

async function getEventWithTournament(eventId: string) {
  return prisma.event.findUnique({
    where: { id: eventId },
    include: { tournament: true },
  });
}

export async function registerSingles(
  eventId: string,
  _prevState: EntryActionState,
  _formData: FormData,
): Promise<EntryActionState> {
  const userId = await requireUserId();

  const event = await getEventWithTournament(eventId);
  if (!event) return { error: "Event not found." };
  if (isDoublesEventType(event.type)) return { error: "This event requires a partner." };
  if (!registrationIsOpen(event.tournament.registrationDeadline)) {
    return { error: "Registration is closed for this tournament." };
  }

  try {
    await prisma.entry.create({
      data: {
        eventId,
        status: "CONFIRMED",
        players: {
          create: [{ eventId, userId, role: "INITIATOR", confirmed: true }],
        },
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "You're already registered for this event." };
    }
    throw error;
  }

  revalidatePath(`/t/${event.tournament.slug}`);
  revalidatePath("/dashboard");
  return {};
}

export async function registerNeedsPartner(
  eventId: string,
  _prevState: EntryActionState,
  _formData: FormData,
): Promise<EntryActionState> {
  const userId = await requireUserId();

  const event = await getEventWithTournament(eventId);
  if (!event) return { error: "Event not found." };
  if (!isDoublesEventType(event.type)) return { error: "This event doesn't take a partner." };
  if (!registrationIsOpen(event.tournament.registrationDeadline)) {
    return { error: "Registration is closed for this tournament." };
  }

  try {
    await prisma.entry.create({
      data: {
        eventId,
        status: "NEEDS_PARTNER",
        players: {
          create: [{ eventId, userId, role: "INITIATOR", confirmed: true }],
        },
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "You're already registered for this event." };
    }
    throw error;
  }

  revalidatePath(`/t/${event.tournament.slug}`);
  revalidatePath("/dashboard");
  return {};
}

const partnerEmailSchema = z.object({
  partnerEmail: z.email("Enter your partner's email address"),
});

export async function registerWithPartner(
  eventId: string,
  _prevState: EntryActionState,
  formData: FormData,
): Promise<EntryActionState> {
  const userId = await requireUserId();

  const event = await getEventWithTournament(eventId);
  if (!event) return { error: "Event not found." };
  if (!isDoublesEventType(event.type)) return { error: "This event doesn't take a partner." };
  if (!registrationIsOpen(event.tournament.registrationDeadline)) {
    return { error: "Registration is closed for this tournament." };
  }

  const parsed = partnerEmailSchema.safeParse({
    partnerEmail: formData.get("partnerEmail"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const me = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (parsed.data.partnerEmail.toLowerCase() === me.email.toLowerCase()) {
    return { error: "You can't invite yourself as a partner." };
  }

  const partner = await prisma.user.findUnique({
    where: { email: parsed.data.partnerEmail },
  });
  if (!partner) {
    return { error: "No account found with that email." };
  }

  const existing = await prisma.entryPlayer.findMany({
    where: { eventId, userId: { in: [userId, partner.id] } },
  });
  if (existing.some((e) => e.userId === userId)) {
    return { error: "You're already registered for this event." };
  }
  if (existing.some((e) => e.userId === partner.id)) {
    return { error: "That player is already registered for this event." };
  }

  try {
    await prisma.entry.create({
      data: {
        eventId,
        status: "PENDING_PARTNER",
        players: {
          create: [
            { eventId, userId, role: "INITIATOR", confirmed: true },
            { eventId, userId: partner.id, role: "PARTNER", confirmed: false },
          ],
        },
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "One of you is already registered for this event." };
    }
    throw error;
  }

  revalidatePath(`/t/${event.tournament.slug}`);
  revalidatePath("/dashboard");
  return {};
}

async function requirePendingPartner(entryId: string, userId: string) {
  const entryPlayer = await prisma.entryPlayer.findFirst({
    where: { entryId, userId, role: "PARTNER", confirmed: false },
  });
  if (!entryPlayer) {
    throw new Error("No pending partner invitation found.");
  }
  return entryPlayer;
}

export async function confirmPartnerInvite(entryId: string): Promise<void> {
  const userId = await requireUserId();
  await requirePendingPartner(entryId, userId);

  await prisma.$transaction([
    prisma.entryPlayer.updateMany({
      where: { entryId, userId },
      data: { confirmed: true },
    }),
    prisma.entry.update({ where: { id: entryId }, data: { status: "CONFIRMED" } }),
  ]);

  revalidatePath("/dashboard");
}

export async function declinePartnerInvite(entryId: string): Promise<void> {
  const userId = await requireUserId();
  await requirePendingPartner(entryId, userId);

  await prisma.$transaction([
    prisma.entryPlayer.deleteMany({ where: { entryId, userId } }),
    prisma.entry.update({ where: { id: entryId }, data: { status: "NEEDS_PARTNER" } }),
  ]);

  revalidatePath("/dashboard");
}

export async function withdrawEntry(entryId: string): Promise<void> {
  const userId = await requireUserId();

  const entry = await prisma.entry.findUnique({
    where: { id: entryId },
    include: { players: true, event: { include: { tournament: true } } },
  });
  if (!entry) redirect("/dashboard");

  const isParticipant = entry.players.some((p) => p.userId === userId);
  if (!isParticipant) redirect("/dashboard");

  if (!registrationIsOpen(entry.event.tournament.registrationDeadline)) {
    throw new Error("Registration is closed; ask the organizer to withdraw this entry.");
  }

  await prisma.entry.delete({ where: { id: entryId } });

  revalidatePath(`/t/${entry.event.tournament.slug}`);
  revalidatePath("/dashboard");
}

export async function removeEntryAsOrganizer(entryId: string): Promise<void> {
  const userId = await requireUserId();

  const entry = await prisma.entry.findUnique({
    where: { id: entryId },
    include: { event: { include: { tournament: true } } },
  });
  if (!entry || entry.event.tournament.organizerId !== userId) {
    redirect("/organizer");
  }

  await prisma.entry.delete({ where: { id: entryId } });

  revalidatePath(`/organizer/${entry.event.tournament.slug}/${entry.eventId}`);
  revalidatePath(`/t/${entry.event.tournament.slug}`);
}

export async function pairEntries(
  eventId: string,
  _prevState: EntryActionState,
  formData: FormData,
): Promise<EntryActionState> {
  const userId = await requireUserId();

  const event = await getEventWithTournament(eventId);
  if (!event || event.tournament.organizerId !== userId) {
    return { error: "Event not found." };
  }

  const entryIdA = formData.get("entryIdA");
  const entryIdB = formData.get("entryIdB");
  if (typeof entryIdA !== "string" || typeof entryIdB !== "string" || !entryIdA || !entryIdB) {
    return { error: "Select two entries to pair." };
  }
  if (entryIdA === entryIdB) {
    return { error: "Select two different entries to pair." };
  }

  const [a, b] = await Promise.all([
    prisma.entry.findUnique({ where: { id: entryIdA }, include: { players: true } }),
    prisma.entry.findUnique({ where: { id: entryIdB }, include: { players: true } }),
  ]);

  if (
    !a ||
    !b ||
    a.eventId !== eventId ||
    b.eventId !== eventId ||
    a.status !== "NEEDS_PARTNER" ||
    b.status !== "NEEDS_PARTNER"
  ) {
    return { error: "Both entries must be unpaired registrations for this event." };
  }

  await prisma.$transaction([
    prisma.entryPlayer.update({
      where: { id: b.players[0].id },
      data: { entryId: entryIdA, role: "PARTNER" },
    }),
    prisma.entry.update({ where: { id: entryIdA }, data: { status: "CONFIRMED" } }),
    prisma.entry.delete({ where: { id: entryIdB } }),
  ]);

  revalidatePath(`/organizer/${event.tournament.slug}/${eventId}`);
  return {};
}
