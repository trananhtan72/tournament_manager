"use server";

import { z } from "zod";
import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { revalidateTournament } from "@/lib/revalidate";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slugify";
import { requireUserId } from "@/lib/session";
import { MAX_COURTS, MIN_COURTS } from "@/lib/tournament/courts";
import {
  MAX_REGULATIONS_JSON_LENGTH,
  isRegulationsEmpty,
  sanitizeRegulations,
} from "@/lib/regulations";

export type TournamentActionState = { error?: string };

// Blank optional inputs arrive as "" — treat them as "not set".
const optionalDate = (message: string) =>
  z.preprocess(
    (value) => (value === "" || value == null ? null : value),
    z.coerce.date({ error: message }).nullable(),
  );

const tournamentSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(150),
    venue: z.string().trim().min(1, "Venue is required").max(200),
    startDate: z.coerce.date({ error: "Enter a valid start date" }),
    endDate: z.coerce.date({ error: "Enter a valid end date" }),
    registrationDeadline: z.coerce.date({
      error: "Enter a valid registration deadline",
    }),
    courtCount: z.coerce
      .number({ error: `The number of courts must be between ${MIN_COURTS} and ${MAX_COURTS}` })
      .int({ error: `The number of courts must be between ${MIN_COURTS} and ${MAX_COURTS}` })
      .min(MIN_COURTS, { error: `The number of courts must be between ${MIN_COURTS} and ${MAX_COURTS}` })
      .max(MAX_COURTS, { error: `The number of courts must be between ${MIN_COURTS} and ${MAX_COURTS}` }),
    registrationOpensAt: optionalDate("Enter a valid date for when entries open"),
    withdrawalDeadline: optionalDate("Enter a valid withdrawal deadline"),
  })
  .refine((data) => data.endDate >= data.startDate, {
    error: "End date must be on or after the start date",
    path: ["endDate"],
  })
  .refine((data) => data.registrationDeadline <= data.startDate, {
    error: "Registration deadline must be on or before the start date",
    path: ["registrationDeadline"],
  })
  .refine((data) => !data.registrationOpensAt || data.registrationOpensAt <= data.registrationDeadline, {
    error: "Entries must open on or before the registration deadline",
    path: ["registrationOpensAt"],
  })
  .refine((data) => !data.withdrawalDeadline || data.withdrawalDeadline >= data.registrationDeadline, {
    error: "The withdrawal deadline must be on or after the registration deadline",
    path: ["withdrawalDeadline"],
  })
  .refine((data) => !data.withdrawalDeadline || data.withdrawalDeadline <= data.startDate, {
    error: "The withdrawal deadline must be on or before the start date",
    path: ["withdrawalDeadline"],
  });

function tournamentFormValues(formData: FormData) {
  return {
    name: formData.get("name"),
    venue: formData.get("venue"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    registrationDeadline: formData.get("registrationDeadline"),
    courtCount: formData.get("courtCount"),
    registrationOpensAt: formData.get("registrationOpensAt") ?? "",
    withdrawalDeadline: formData.get("withdrawalDeadline") ?? "",
  };
}

async function uniqueSlugFor(name: string) {
  const base = slugify(name) || "tournament";
  let candidate = base;
  let suffix = 1;
  while (await prisma.tournament.findUnique({ where: { slug: candidate } })) {
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
  return candidate;
}

export async function createTournament(
  _prevState: TournamentActionState,
  formData: FormData,
): Promise<TournamentActionState> {
  const userId = await requireUserId();

  const parsed = tournamentSchema.safeParse(tournamentFormValues(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const slug = await uniqueSlugFor(parsed.data.name);

  const tournament = await prisma.tournament.create({
    data: { ...parsed.data, slug, organizerId: userId },
  });

  revalidatePath("/organizer");
  redirect(`/organizer/${tournament.slug}`);
}

export async function updateTournament(
  tournamentId: string,
  _prevState: TournamentActionState,
  formData: FormData,
): Promise<TournamentActionState> {
  const userId = await requireUserId();

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
  });
  if (!tournament || tournament.organizerId !== userId) {
    return { error: "Tournament not found." };
  }

  const parsed = tournamentSchema.safeParse(tournamentFormValues(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await prisma.tournament.update({
    where: { id: tournamentId },
    data: parsed.data,
  });

  revalidatePath("/organizer");
  revalidateTournament(tournament.slug);
  return {};
}

export async function deleteTournament(tournamentId: string): Promise<void> {
  const userId = await requireUserId();

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
  });
  if (!tournament || tournament.organizerId !== userId) {
    redirect("/organizer");
  }

  await prisma.tournament.delete({ where: { id: tournamentId } });

  revalidatePath("/organizer");
  redirect("/organizer");
}

export type RegulationsActionState = { error?: string; saved?: boolean };

/** Saves the rich-text regulations document; an empty document clears it. */
export async function updateRegulations(
  tournamentId: string,
  _prevState: RegulationsActionState,
  formData: FormData,
): Promise<RegulationsActionState> {
  const userId = await requireUserId();

  const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!tournament || tournament.organizerId !== userId) {
    return { error: "Tournament not found." };
  }

  const raw = formData.get("regulations");
  if (typeof raw !== "string" || raw.length > MAX_REGULATIONS_JSON_LENGTH) {
    return { error: "The regulations document is too large." };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { error: "The regulations couldn't be read. Please try again." };
  }
  const doc = sanitizeRegulations(parsed);
  if (!doc) {
    return { error: "The regulations couldn't be read. Please try again." };
  }

  await prisma.tournament.update({
    where: { id: tournamentId },
    data: { regulations: isRegulationsEmpty(doc) ? Prisma.DbNull : (doc as unknown as Prisma.InputJsonValue) },
  });

  revalidateTournament(tournament.slug);
  return { saved: true };
}
