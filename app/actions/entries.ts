"use server";

import { z } from "zod";
import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { registrationStatus, withdrawalIsOpen } from "@/lib/registrationDeadline";
import { formatDate } from "@/lib/formatDate";
import { isDoublesCategory } from "@/lib/eventLabels";
import { notify } from "@/lib/notify";
import { playerName, entryLabel } from "@/lib/playerDisplay";

export type EntryActionState = { error?: string };

async function getEventWithTournament(eventId: string) {
  return prisma.event.findUnique({
    where: { id: eventId },
    include: { tournament: true },
  });
}

type EventForNotice = {
  id: string;
  name: string;
  tournament: { slug: string; name: string; organizerId: string };
};

// Tell the organizer a player has registered, with what (if anything) they
// need to do about it. Skipped when the organizer is the one registering.
async function notifyOrganizerOfRegistration(
  event: EventForNotice,
  actorUserId: string,
  who: string,
  detail: string,
): Promise<void> {
  if (event.tournament.organizerId === actorUserId) return;
  await notify(
    event.tournament.organizerId,
    `${who} registered for ${event.name} at ${event.tournament.name}${detail}`,
    `/organizer/${event.tournament.slug}/${event.id}`,
  );
}

const AWAITING_APPROVAL = " — waiting for your approval.";

function revalidateOrganizerViews(event: { id: string; tournament: { slug: string } }) {
  revalidatePath(`/organizer/${event.tournament.slug}/${event.id}`);
  revalidatePath(`/organizer/${event.tournament.slug}`);
}

async function notifyEntryPlayers(
  players: { userId: string | null }[],
  message: string,
  link: string,
): Promise<void> {
  await Promise.all(
    players.flatMap((p) => (p.userId ? [notify(p.userId, message, link)] : [])),
  );
}

/** Why registration can't happen right now, or null if it can. */
function registrationBlockedReason(tournament: {
  registrationOpensAt: Date | null;
  registrationDeadline: Date;
}): string | null {
  const status = registrationStatus(tournament);
  if (status === "open") return null;
  return status === "not_open"
    ? `Registration hasn't opened yet — entries open on ${formatDate(tournament.registrationOpensAt!)}.`
    : "Registration is closed for this tournament.";
}

export async function registerSingles(
  eventId: string,
  _prevState: EntryActionState,
  _formData: FormData,
): Promise<EntryActionState> {
  const userId = await requireUserId();

  const event = await getEventWithTournament(eventId);
  if (!event) return { error: "Event not found." };
  if (isDoublesCategory(event.category)) return { error: "This event requires a partner." };
  const blocked = registrationBlockedReason(event.tournament);
  if (blocked) return { error: blocked };

  try {
    await prisma.entry.create({
      data: {
        eventId,
        status: "PENDING_APPROVAL",
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

  const me = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  await notifyOrganizerOfRegistration(event, userId, me.name, AWAITING_APPROVAL);

  revalidatePath(`/t/${event.tournament.slug}`);
  revalidateOrganizerViews(event);
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
  if (!isDoublesCategory(event.category)) return { error: "This event doesn't take a partner." };
  const blocked = registrationBlockedReason(event.tournament);
  if (blocked) return { error: blocked };

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

  const me = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  await notifyOrganizerOfRegistration(
    event,
    userId,
    me.name,
    " and needs a partner — you can pair them from the entries page.",
  );

  revalidatePath(`/t/${event.tournament.slug}`);
  revalidateOrganizerViews(event);
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
  if (!isDoublesCategory(event.category)) return { error: "This event doesn't take a partner." };
  const blocked = registrationBlockedReason(event.tournament);
  if (blocked) return { error: blocked };

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
    `${me.name} invited you to be their partner for ${event.name} at ${event.tournament.name}.`,
    "/dashboard",
  );
  await notifyOrganizerOfRegistration(
    event,
    userId,
    me.name,
    ` with ${partner.name} — waiting for ${partner.name} to confirm.`,
  );

  revalidatePath(`/t/${event.tournament.slug}`);
  revalidateOrganizerViews(event);
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
    prisma.entry.update({ where: { id: entryId }, data: { status: "PENDING_APPROVAL" } }),
  ]);

  // The partner-invite flow only ever involves registered users (never a
  // quick-added guest), so initiator.userId is always set here.
  await notify(
    initiator.userId!,
    `${playerName(me)} accepted your partner invitation for ${entry.event.name} at ${entry.event.tournament.name}. Your entry now needs the organizer's approval.`,
    `/t/${entry.event.tournament.slug}`,
  );
  await notifyOrganizerOfRegistration(entry.event, userId, entryLabel(entry), AWAITING_APPROVAL);

  revalidatePath(`/t/${entry.event.tournament.slug}`);
  revalidateOrganizerViews(entry.event);
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
    `${playerName(me)} declined your partner invitation for ${entry.event.name} at ${entry.event.tournament.name}. You're back to needing a partner.`,
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

  if (!withdrawalIsOpen(entry.event.tournament)) {
    throw new Error("The withdrawal deadline has passed; ask the organizer to withdraw this entry.");
  }
  if (entry.event.drawPublished) {
    throw new Error("The draw has been published; contact the organizer to withdraw.");
  }

  // If this entry is already placed in a (still-draft) draw, withdrawing
  // would leave the bracket pointing at a deleted entry — clear the draft so
  // the organizer can regenerate with the updated entry list.
  const inDraftDraw = await prisma.match.count({
    where: { eventId: entry.eventId, OR: [{ entry1Id: entryId }, { entry2Id: entryId }] },
  });
  if (inDraftDraw > 0) {
    await prisma.match.deleteMany({ where: { eventId: entry.eventId } });
  }
  await prisma.entry.delete({ where: { id: entryId } });

  const other = entry.players.find((p) => p.userId !== userId);
  if (other?.userId && entry.status !== "PENDING_PARTNER") {
    await notify(
      other.userId,
      `${playerName(me)} withdrew from ${entry.event.name} at ${entry.event.tournament.name}, so your entry was cancelled.`,
      `/t/${entry.event.tournament.slug}`,
    );
  }

  revalidatePath(`/t/${entry.event.tournament.slug}`);
  revalidatePath("/dashboard");
}

export async function removeEntryAsOrganizer(
  entryId: string,
  _prevState: EntryActionState,
  _formData: FormData,
): Promise<EntryActionState> {
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
  if (entry.event.drawPublished) {
    return { error: "Can't remove this entry — the draw has already been published." };
  }

  const inDraftDraw = await prisma.match.count({
    where: { eventId: entry.eventId, OR: [{ entry1Id: entryId }, { entry2Id: entryId }] },
  });
  if (inDraftDraw > 0) {
    await prisma.match.deleteMany({ where: { eventId: entry.eventId } });
  }
  await prisma.entry.delete({ where: { id: entryId } });

  await notifyEntryPlayers(
    entry.players,
    `Your entry for ${entry.event.name} at ${entry.event.tournament.name} was removed by the organizer.`,
    `/t/${entry.event.tournament.slug}`,
  );

  revalidatePath(`/organizer/${entry.event.tournament.slug}/${entry.eventId}`);
  revalidatePath(`/t/${entry.event.tournament.slug}`);
  return {};
}

async function findPendingEntryForOrganizer(entryId: string, userId: string) {
  const entry = await prisma.entry.findUnique({
    where: { id: entryId },
    include: { event: { include: { tournament: true } }, players: true },
  });
  if (!entry || entry.event.tournament.organizerId !== userId) {
    redirect("/organizer");
  }
  if (entry.status !== "PENDING_APPROVAL") {
    return { error: "This registration isn't waiting for approval anymore." };
  }
  return { entry };
}

function revalidateAfterReview(entry: { eventId: string; event: { tournament: { slug: string } } }) {
  const { slug } = entry.event.tournament;
  revalidatePath(`/organizer/${slug}/${entry.eventId}`);
  revalidatePath(`/organizer/${slug}`);
  revalidatePath(`/t/${slug}`);
  revalidatePath("/dashboard");
}

export async function approveEntry(
  entryId: string,
  _prevState: EntryActionState,
  _formData: FormData,
): Promise<EntryActionState> {
  const userId = await requireUserId();
  const found = await findPendingEntryForOrganizer(entryId, userId);
  if ("error" in found) return found;
  const { entry } = found;

  // Guarded on the status so a double-click or a second tab can't approve (and
  // notify) twice.
  const { count } = await prisma.entry.updateMany({
    where: { id: entryId, status: "PENDING_APPROVAL" },
    data: { status: "CONFIRMED" },
  });
  if (count === 0) return { error: "This registration isn't waiting for approval anymore." };

  await notifyEntryPlayers(
    entry.players,
    `Your registration for ${entry.event.name} at ${entry.event.tournament.name} was approved.`,
    `/t/${entry.event.tournament.slug}`,
  );

  revalidateAfterReview(entry);
  return {};
}

export async function rejectEntry(
  entryId: string,
  _prevState: EntryActionState,
  _formData: FormData,
): Promise<EntryActionState> {
  const userId = await requireUserId();
  const found = await findPendingEntryForOrganizer(entryId, userId);
  if ("error" in found) return found;
  const { entry } = found;

  // A pending entry is never in a draw (draws only take confirmed entries), so
  // unlike removing a confirmed entry this is fine after the draw is published.
  const { count } = await prisma.entry.deleteMany({
    where: { id: entryId, status: "PENDING_APPROVAL" },
  });
  if (count === 0) return { error: "This registration isn't waiting for approval anymore." };

  await notifyEntryPlayers(
    entry.players,
    `Your registration for ${entry.event.name} at ${entry.event.tournament.name} wasn't approved by the organizer.`,
    `/t/${entry.event.tournament.slug}`,
  );

  revalidateAfterReview(entry);
  return {};
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

  const notifications: Promise<void>[] = [];
  if (a.players[0].userId) {
    notifications.push(
      notify(
        a.players[0].userId,
        `You've been paired with ${playerName(b.players[0])} for ${event.name} at ${event.tournament.name}.`,
        `/t/${event.tournament.slug}`,
      ),
    );
  }
  if (b.players[0].userId) {
    notifications.push(
      notify(
        b.players[0].userId,
        `You've been paired with ${playerName(a.players[0])} for ${event.name} at ${event.tournament.name}.`,
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

  const doubles = isDoublesCategory(event.category);
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
