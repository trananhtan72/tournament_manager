"use server";

import { z } from "zod";
import { PaymentMethod, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { revalidateTournament } from "@/lib/revalidate";
import { parseDateTimeLocal } from "@/lib/tournament/schedule";

export type PaymentActionState = { error?: string; saved?: boolean };

/** A registered athlete (stable id), or a guest matched by name within the tournament. */
export type AthleteKey = { userId: string } | { guestName: string };

function paymentWhere(tournamentId: string, athlete: AthleteKey): Prisma.TournamentPaymentWhereUniqueInput {
  return "userId" in athlete
    ? { tournamentId_userId: { tournamentId, userId: athlete.userId } }
    : { tournamentId_guestName: { tournamentId, guestName: athlete.guestName } };
}

const detailsSchema = z.object({
  amount: z.preprocess(
    (v) => (v === "" || v == null ? null : v),
    z.coerce.number({ error: "Enter a valid amount" }).min(0, "Amount can't be negative").nullable(),
  ),
  method: z.preprocess((v) => (v === "" ? null : v), z.enum(PaymentMethod).nullable()),
  note: z.string().trim().max(500, "Note is too long (500 characters max)"),
});

/**
 * Saves one athlete's amount/method/note, covering every event they've
 * entered in this tournament — one payment per athlete, not per event, since
 * they typically pay once. Which submit button fired the form (`intent`)
 * decides what happens to `paidAt`:
 *  - "save" (the unpaid card, and the paid card's "Save" once editing):
 *    leaves paidAt untouched unless the form includes its own paidAt field
 *    (the edit form lets the organizer correct a mistaken timestamp);
 *  - "pay": stamps paidAt with the device time the form injected at submit,
 *    moving the athlete into the paid column;
 *  - "unpay": clears paidAt, moving them back to unpaid.
 */
export async function saveAthletePayment(
  tournamentId: string,
  athlete: AthleteKey,
  _prevState: PaymentActionState,
  formData: FormData,
): Promise<PaymentActionState> {
  const userId = await requireUserId();
  const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!tournament || tournament.organizerId !== userId) {
    return { error: "Tournament not found." };
  }

  const parsed = detailsSchema.safeParse({
    amount: String(formData.get("amount") ?? ""),
    method: String(formData.get("method") ?? ""),
    note: String(formData.get("note") ?? ""),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const intent = String(formData.get("intent") ?? "save");
  let paidAt: Date | null | undefined; // undefined = leave as-is
  if (intent === "pay") {
    paidAt = parseDateTimeLocal(String(formData.get("paidAt") ?? ""));
    if (!paidAt) return { error: "Couldn't read the current time. Reload the page and try again." };
  } else if (intent === "unpay") {
    paidAt = null;
  } else if (formData.has("paidAt")) {
    const raw = String(formData.get("paidAt") ?? "").trim();
    if (raw === "") return { error: 'Enter when this was paid, or use "Mark as unpaid" to clear it.' };
    paidAt = parseDateTimeLocal(raw);
    if (!paidAt) return { error: "Enter a valid payment time." };
  }

  const details = { amount: parsed.data.amount, method: parsed.data.method, note: parsed.data.note || null };

  await prisma.tournamentPayment.upsert({
    where: paymentWhere(tournamentId, athlete),
    create: {
      tournamentId,
      userId: "userId" in athlete ? athlete.userId : null,
      guestName: "guestName" in athlete ? athlete.guestName : null,
      ...details,
      ...(paidAt !== undefined ? { paidAt } : {}),
    },
    update: { ...details, ...(paidAt !== undefined ? { paidAt } : {}) },
  });

  revalidateTournament(tournament.slug);
  return { saved: true };
}
