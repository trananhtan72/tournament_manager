"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { revalidateTournament } from "@/lib/revalidate";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { formatDate } from "@/lib/formatDate";
import { isWithinTournamentDays, parseDateTimeLocal } from "@/lib/tournament/schedule";

export type ScheduleActionState = { error?: string; saved?: boolean };

const scheduleSchema = z.object({
  scheduledAt: z.string().trim(),
  court: z
    .string()
    .trim()
    .transform((court) => court.replace(/\s+/g, " "))
    .pipe(z.string().max(40, "Court name is too long (40 characters max)")),
});

/** Sets (or, with both fields blank, clears) a match's time and court. */
export async function setMatchSchedule(
  matchId: string,
  _prevState: ScheduleActionState,
  formData: FormData,
): Promise<ScheduleActionState> {
  const userId = await requireUserId();

  const parsed = scheduleSchema.safeParse({
    scheduledAt: String(formData.get("scheduledAt") ?? ""),
    court: String(formData.get("court") ?? ""),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { event: { include: { tournament: true } } },
  });
  if (!match || match.event.tournament.organizerId !== userId) {
    return { error: "Match not found." };
  }
  if (match.isBye) {
    return { error: "A bye isn't played, so it can't be scheduled." };
  }

  const { scheduledAt: rawTime, court } = parsed.data;
  if (!rawTime && court) {
    return { error: "Set a time before assigning a court." };
  }

  let scheduledAt: Date | null = null;
  if (rawTime) {
    scheduledAt = parseDateTimeLocal(rawTime);
    if (!scheduledAt) {
      return { error: "Enter a valid date and time." };
    }
    const { startDate, endDate } = match.event.tournament;
    if (!isWithinTournamentDays(scheduledAt, startDate, endDate)) {
      return {
        error: `Pick a time on a tournament day (${formatDate(startDate)} – ${formatDate(endDate)}).`,
      };
    }
  }

  await prisma.match.update({
    where: { id: matchId },
    data: { scheduledAt, court: court || null },
  });

  const { slug } = match.event.tournament;
  revalidateTournament(slug);
  revalidatePath("/dashboard");
  return { saved: true };
}
