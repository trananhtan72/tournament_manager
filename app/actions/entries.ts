"use server";

import { z } from "zod";
import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { registrationIsOpen } from "@/lib/registrationDeadline";
import { isDoublesEventType, eventTypeLabels } from "@/lib/eventLabels";
import { notify } from "@/lib/notify";
import { playerName } from "@/lib/playerDisplay";

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

  await notify(
    partner.id,
    `${me.name} invited you to be their partner for ${eventTypeLabels[event.type]} at ${event.tournament.name}.`,
    "/dashboard",
  );

  revalidatePath(`/t/${event.tournament.slug}`);
  revalidatePath("/dashboard");
  return {};
}

async function requirePendingPartnerEntry(entryId: string, userId: string) {
  const entry = await prisma.entry.findFirst({
    where: { id: entryId, players: { some: { userId, role: "PARTNER", confirmed: false } } },
    include: {
      event: { include: { tournament: true } },
      players: { include: { user: true } },
    },
  });
  if (!entry) {
    throw new Error("No pending partner invitation found.");
  }
  return entry;
}

export async function confirmPartnerInvite(entryId: string): Promise<void> {
  const userId = await requireUserId();
  const entry = await requirePendingPartnerEntry(entryId, userId);
  const me = entry.players.find((p) => p.userId === userId)!;
  const initiator = entry.players.find((p) => p.role === "INITIATOR")!;

  await prisma.$transaction([
    prisma.entryPlayer.updateMany({
      where: { entryId, userId },
      data: { confirmed: true },
    }),
    prisma.entry.update({ where: { id: entryId }, data: { status: "CONFIRMED" } }),
  ]);

  // The partner-invite flow only ever involves registered users (never a
  // quick-added guest), so initiator.userId is always set here.
  await notify(
    initiator.userId!,
    `${playerName(me)} accepted your partner invitation for ${eventTypeLabels[entry.event.type]} at ${entry.event.tournament.name}.`,
    `/t/${entry.event.tournament.slug}`,
  );

  revalidatePath("/dashboard");
}

export async function declinePartnerInvite(entryId: string): Promise<void> {
  const userId = await requireUserId();
  const entry = await requirePendingPartnerEntry(entryId, userId);
  const me = entry.players.find((p) => p.userId === userId)!;
  const initiator = entry.players.find((p) => p.role === "INITIATOR")!;

  await prisma.$transaction([
    prisma.entryPlayer.deleteMany({ where: { entryId, userId } }),
    prisma.entry.update({ where: { id: entryId }, data: { status: "NEEDS_PARTNER" } }),
  ]);

  await notify(
    initiator.userId!,
    `${playerName(me)} declined your partner invitation for ${eventTypeLabels[entry.event.type]} at ${entry.event.tournament.name}. You're back to needing a partner.`,
    `/t/${entry.event.tournament.slug}`,
  );

  revalidatePath("/dashboard");
}

export async function withdrawEntry(entryId: string): Promise<void> {
  const userId = await requireUserId();

  const entry = await prisma.entry.findUnique({
    where: { id: entryId },
    include: {
      players: { include: { user: true } },
      event: { include: { tournament: true } },
    },
  });
  if (!entry) redirect("/dashboard");

  const me = entry.players.find((p) => p.userId === userId);
  if (!me) redirect("/dashboard");

  if (!registrationIsOpen(entry.event.tournament.registrationDeadline)) {
    throw new Error("Registration is closed; ask the organizer to withdraw this entry.");
  }

  await prisma.entry.delete({ where: { id: entryId } });

  const other = entry.players.find((p) => p.userId !== userId);
  if (other?.userId && entry.status !== "PENDING_PARTNER") {
    await notify(
      other.userId,
      `${playerName(me)} withdrew from ${eventTypeLabels[entry.event.type]} at ${entry.event.tournament.name}, so your entry was cancelled.`,
      `/t/${entry.event.tournament.slug}`,
    );
  }

  revalidatePath(`/t/${entry.event.tournament.slug}`);
  revalidatePath("/dashboard");
}

export async function removeEntryAsOrganizer(entryId: string): Promise<void> {
  const userId = await requireUserId();

  const entry = await prisma.entry.findUnique({
    where: { id: entryId },
    include: {
      event: { include: { tournament: true } },
      players: true,
    },
  });
  if (!entry || entry.event.tournament.organizerId !== userId) {
    redirect("/organizer");
  }

  await prisma.entry.delete({ where: { id: entryId } });

  const notifiablePlayers = entry.players.filter(
    (p): p is typeof p & { userId: string } => p.userId !== null,
  );
  await Promise.all(
    notifiablePlayers.map((p) =>
      notify(
        p.userId,
        `Your entry for ${eventTypeLabels[entry.event.type]} at ${entry.event.tournament.name} was removed by the organizer.`,
        `/t/${entry.event.tournament.slug}`,
      ),
    ),
  );

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
    prisma.entry.findUnique({ where: { id: entryIdA }, include: { players: { include: { user: true } } } }),
    prisma.entry.findUnique({ where: { id: entryIdB }, include: { players: { include: { user: true } } } }),
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

  const eventLabel = eventTypeLabels[event.type];
  const notifications: Promise<void>[] = [];
  if (a.players[0].userId) {
    notifications.push(
      notify(
        a.players[0].userId,
        `You've been paired with ${playerName(b.players[0])} for ${eventLabel} at ${event.tournament.name}.`,
        `/t/${event.tournament.slug}`,
      ),
    );
  }
  if (b.players[0].userId) {
    notifications.push(
      notify(
        b.players[0].userId,
        `You've been paired with ${playerName(a.players[0])} for ${eventLabel} at ${event.tournament.name}.`,
        `/t/${event.tournament.slug}`,
      ),
    );
  }
  await Promise.all(notifications);

  revalidatePath(`/organizer/${event.tournament.slug}/${eventId}`);
  return {};
}

type PlayerSlotResolution =
  | { ok: true; userId: string | null; guestName: string | null }
  | { ok: false; error: string };

async function resolvePlayerSlot(name: string, email: string): Promise<PlayerSlotResolution> {
  const trimmedName = name.trim();
  if (!trimmedName) {
    return { ok: false, error: "Enter a name for each player." };
  }

  const trimmedEmail = email.trim();
  if (!trimmedEmail) {
    return { ok: true, userId: null, guestName: trimmedName };
  }

  const parsedEmail = z.email().safeParse(trimmedEmail);
  if (!parsedEmail.success) {
    return { ok: false, error: `Enter a valid email for ${trimmedName}, or leave it blank.` };
  }

  const user = await prisma.user.findUnique({ where: { email: parsedEmail.data } });
  if (!user) {
    return { ok: false, error: `No account found with email ${trimmedEmail}.` };
  }

  return { ok: true, userId: user.id, guestName: null };
}

export async function quickAddEntry(
  eventId: string,
  _prevState: EntryActionState,
  formData: FormData,
): Promise<EntryActionState> {
  const userId = await requireUserId();

  const event = await getEventWithTournament(eventId);
  if (!event || event.tournament.organizerId !== userId) {
    return { error: "Event not found." };
  }

  const player1 = await resolvePlayerSlot(
    String(formData.get("player1Name") ?? ""),
    String(formData.get("player1Email") ?? ""),
  );
  if (!player1.ok) return { error: player1.error };

  const doubles = isDoublesEventType(event.type);
  let player2: Extract<PlayerSlotResolution, { ok: true }> | null = null;
  if (doubles) {
    const player2Name = String(formData.get("player2Name") ?? "").trim();
    if (player2Name) {
      const resolved = await resolvePlayerSlot(
        player2Name,
        String(formData.get("player2Email") ?? ""),
      );
      if (!resolved.ok) return { error: resolved.error };
      player2 = resolved;
    }
  }

  const registeredUserIds = [player1.userId, player2?.userId].filter(
    (id): id is string => id !== null && id !== undefined,
  );
  if (registeredUserIds.length > 0) {
    const existing = await prisma.entryPlayer.findFirst({
      where: { eventId, userId: { in: registeredUserIds } },
      include: { user: true },
    });
    if (existing) {
      return { error: `${playerName(existing)} is already registered for this event.` };
    }
  }

  const status: "CONFIRMED" | "NEEDS_PARTNER" = doubles && !player2 ? "NEEDS_PARTNER" : "CONFIRMED";

  try {
    await prisma.entry.create({
      data: {
        eventId,
        status,
        players: {
          create: [
            {
              eventId,
              userId: player1.userId,
              guestName: player1.guestName,
              role: "INITIATOR",
              confirmed: true,
            },
            ...(player2
              ? [
                  {
                    eventId,
                    userId: player2.userId,
                    guestName: player2.guestName,
                    role: "PARTNER" as const,
                    confirmed: true,
                  },
                ]
              : []),
          ],
        },
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "One of these players is already registered for this event." };
    }
    throw error;
  }

  revalidatePath(`/organizer/${event.tournament.slug}/${eventId}`);
  revalidatePath(`/t/${event.tournament.slug}`);
  return {};
}
