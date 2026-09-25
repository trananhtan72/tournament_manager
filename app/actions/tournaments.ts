"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slugify";
import { requireUserId } from "@/lib/session";

export type TournamentActionState = { error?: string };

// Blank optional inputs arrive as "" — treat them as "not set".
const optionalDate = (message: string) =>
  z.preprocess(
    (value) => (value === "" || value == null ? null : value),
    z.coerce.date({ error: message }).nullable(),
  );

function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

const tournamentSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(150),
    venue: z.string().trim().min(1, "Venue is required").max(200),
    startDate: z.coerce.date({ error: "Enter a valid start date" }),
    endDate: z.coerce.date({ error: "Enter a valid end date" }),
    registrationDeadline: z.coerce.date({
      error: "Enter a valid registration deadline",
    }),
    registrationOpensAt: optionalDate("Enter a valid date for when entries open"),
    withdrawalDeadline: optionalDate("Enter a valid withdrawal deadline"),
    regulationsUrl: z
      .string()
      .trim()
      .max(500, "The regulations link is too long (500 characters max)")
      .transform((value) => value || null)
      .refine((value) => value === null || isHttpUrl(value), {
        error: "The regulations link must start with http:// or https://",
      }),
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
    registrationOpensAt: formData.get("registrationOpensAt") ?? "",
    withdrawalDeadline: formData.get("withdrawalDeadline") ?? "",
    regulationsUrl: formData.get("regulationsUrl") ?? "",
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
  revalidatePath(`/organizer/${tournament.slug}`);
  revalidatePath(`/t/${tournament.slug}`);
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
