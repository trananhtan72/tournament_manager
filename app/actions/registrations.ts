"use server";

import { z } from "zod";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { revalidateTournament } from "@/lib/revalidate";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { registrationBlockedReason, withdrawalIsOpen } from "@/lib/registrationDeadline";
import { isDoublesCategory } from "@/lib/eventLabels";
import { notify } from "@/lib/notify";
import { notifyOrganizerOfRegistration, type EventForNotice } from "@/app/actions/entries";

export type RegistrationActionState = { error?: string };

type Slot = { eventId: string | null; partnerEmail: string | null };

function readSlots(formData: FormData, slotCount: number): Slot[] {
  const slots: Slot[] = [];
  for (let i = 1; i <= slotCount; i++) {
    const eventId = String(formData.get(`eventId_${i}`) ?? "").trim();
    const partnerEmail = String(formData.get(`partnerEmail_${i}`) ?? "").trim();
    slots.push({ eventId: eventId || null, partnerEmail: partnerEmail || null });
  }
  return slots;
}

type AddPlan =
  | { eventId: string; status: "PENDING_APPROVAL" }
  | { eventId: string; status: "NEEDS_PARTNER" }
  | { eventId: string; status: "PENDING_PARTNER"; partnerId: string; partnerName: string };

/**
 * Replaces the player's picks for one slot-based popup submission: diffs the
 * selected events against their current INITIATOR entries in this tournament
 * (entries where they were only an invited doubles partner are untouched —
 * those are managed from /dashboard) and applies every add/remove in one
 * transaction, all-or-nothing.
 */
export async function updateMyRegistrations(
  tournamentId: string,
  _prevState: RegistrationActionState,
  formData: FormData,
): Promise<RegistrationActionState> {
  const userId = await requireUserId();

  const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!tournament) return { error: "Tournament not found." };
  const blocked = registrationBlockedReason(tournament);
  if (blocked) return { error: blocked };

  const slots = readSlots(formData, tournament.maxEventsPerUser);
  const pickedEventIds = slots.map((s) => s.eventId).filter((id): id is string => id !== null);
  if (new Set(pickedEventIds).size !== pickedEventIds.length) {
    return { error: "You can't pick the same event in two slots." };
  }

  // TEAM events are never pickable here — team signup goes through the
  // organizer/captain-managed roster, not this popup.
  const events = await prisma.event.findMany({
    where: { tournamentId, category: { not: "TEAM" } },
    select: { id: true, name: true, category: true, drawPublished: true },
  });
  const eventById = new Map(events.map((e) => [e.id, e]));
  for (const id of pickedEventIds) {
    if (!eventById.has(id)) return { error: "One of the selected events is no longer available." };
  }

  const myEntries = await prisma.entryPlayer.findMany({
    where: {
      userId,
      role: "INITIATOR",
      entry: { event: { tournamentId, category: { not: "TEAM" } } },
    },
    include: { entry: { include: { event: true, players: true } } },
  });
  const currentByEventId = new Map(myEntries.map((ep) => [ep.entry.eventId, ep.entry]));

  const toAddIds = pickedEventIds.filter((id) => !currentByEventId.has(id));
  const toRemoveIds = [...currentByEventId.keys()].filter((id) => !pickedEventIds.includes(id));

  // Validate every removal first — all-or-nothing, so nothing is written if
  // any single change in this submission is blocked.
  for (const eventId of toRemoveIds) {
    const entry = currentByEventId.get(eventId)!;
    if (!withdrawalIsOpen(tournament)) {
      return {
        error: `Can't update ${entry.event.name} — the withdrawal deadline has passed; ask the organizer to withdraw it.`,
      };
    }
    if (entry.event.drawPublished) {
      return {
        error: `Can't update ${entry.event.name} — the draw has already been published; contact the organizer.`,
      };
    }
  }

  // Validate and resolve every addition before writing anything.
  const me = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const addPlans: AddPlan[] = [];
  for (const slot of slots) {
    if (!slot.eventId || !toAddIds.includes(slot.eventId)) continue;
    const event = eventById.get(slot.eventId)!;

    if (!isDoublesCategory(event.category)) {
      addPlans.push({ eventId: event.id, status: "PENDING_APPROVAL" });
      continue;
    }
    if (!slot.partnerEmail) {
      addPlans.push({ eventId: event.id, status: "NEEDS_PARTNER" });
      continue;
    }

    const parsedEmail = z.email().safeParse(slot.partnerEmail);
    if (!parsedEmail.success) {
      return { error: `Enter a valid email for ${event.name}'s partner, or leave it blank.` };
    }
    if (parsedEmail.data.toLowerCase() === me.email.toLowerCase()) {
      return { error: "You can't invite yourself as a partner." };
    }
    const partner = await prisma.user.findUnique({ where: { email: parsedEmail.data } });
    if (!partner) {
      return { error: `No account found with email ${slot.partnerEmail} for ${event.name}.` };
    }
    const partnerAlreadyIn = await prisma.entryPlayer.findFirst({
      where: { eventId: event.id, userId: partner.id },
    });
    if (partnerAlreadyIn) {
      return { error: `${partner.name} is already registered for ${event.name}.` };
    }
    addPlans.push({ eventId: event.id, status: "PENDING_PARTNER", partnerId: partner.id, partnerName: partner.name });
  }

  // Draft-draw cleanup (same rule as the old withdrawEntry): if a removed
  // entry is already placed in a still-draft draw, the whole draft gets
  // cleared so the organizer can regenerate with the updated entry list.
  const draftDrawEventIds = new Set<string>();
  for (const eventId of toRemoveIds) {
    const entry = currentByEventId.get(eventId)!;
    const inDraftDraw = await prisma.match.count({
      where: { eventId, OR: [{ entry1Id: entry.id }, { entry2Id: entry.id }] },
    });
    if (inDraftDraw > 0) draftDrawEventIds.add(eventId);
  }

  const ops: Prisma.PrismaPromise<unknown>[] = [];
  for (const eventId of toRemoveIds) {
    const entry = currentByEventId.get(eventId)!;
    if (draftDrawEventIds.has(eventId)) {
      ops.push(prisma.match.deleteMany({ where: { eventId } }));
    }
    ops.push(prisma.entry.delete({ where: { id: entry.id } }));
  }
  for (const plan of addPlans) {
    ops.push(
      prisma.entry.create({
        data: {
          eventId: plan.eventId,
          status: plan.status,
          players: {
            create:
              plan.status === "PENDING_PARTNER"
                ? [
                    { eventId: plan.eventId, userId, role: "INITIATOR", confirmed: true },
                    { eventId: plan.eventId, userId: plan.partnerId, role: "PARTNER", confirmed: false },
                  ]
                : [{ eventId: plan.eventId, userId, role: "INITIATOR", confirmed: true }],
          },
        },
      }),
    );
  }

  if (ops.length > 0) {
    try {
      await prisma.$transaction(ops);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return { error: "One of these changes conflicts with an existing registration. Please try again." };
      }
      throw error;
    }
  }

  const notifyEventFor = (eventId: string): EventForNotice => {
    const event = eventById.get(eventId)!;
    return { id: event.id, name: event.name, tournament };
  };

  await Promise.all([
    ...toRemoveIds.map((eventId) => {
      const entry = currentByEventId.get(eventId)!;
      const other = entry.players.find((p) => p.userId !== userId);
      if (!other?.userId || entry.status === "PENDING_PARTNER") return Promise.resolve();
      return notify(
        other.userId,
        `${me.name} withdrew from ${entry.event.name} at ${tournament.name}, so your entry was cancelled.`,
        `/t/${tournament.slug}`,
      );
    }),
    ...addPlans.flatMap((plan) => {
      const event = notifyEventFor(plan.eventId);
      const notifications: Promise<void>[] = [];
      if (plan.status === "PENDING_APPROVAL") {
        notifications.push(notifyOrganizerOfRegistration(event, userId, me.name, " — waiting for your approval."));
      } else if (plan.status === "NEEDS_PARTNER") {
        notifications.push(
          notifyOrganizerOfRegistration(
            event,
            userId,
            me.name,
            " and needs a partner — you can pair them from the entries page.",
          ),
        );
      } else {
        notifications.push(
          notify(plan.partnerId, `${me.name} invited you to be their partner for ${event.name} at ${tournament.name}.`, "/dashboard"),
        );
        notifications.push(
          notifyOrganizerOfRegistration(
            event,
            userId,
            me.name,
            ` with ${plan.partnerName} — waiting for ${plan.partnerName} to confirm.`,
          ),
        );
      }
      return notifications;
    }),
  ]);

  revalidateTournament(tournament.slug);
  revalidatePath("/dashboard");
  return {};
}
