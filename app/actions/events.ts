"use server";

import { z } from "zod";
import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { revalidateTournament } from "@/lib/revalidate";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import {
  ALLOWED_GAMES_PER_MATCH,
  MIN_POINTS_PER_GAME,
  MAX_POINTS_PER_GAME,
} from "@/lib/tournament/gameFormat";

export type EventActionState = { error?: string };

const eventSchema = z.object({
  name: z.string().trim().min(1, "Enter an event name").max(100),
  category: z.enum(["SINGLES", "DOUBLES"], {
    error: "Choose a category",
  }),
  drawFormat: z.enum(
    ["SINGLE_ELIMINATION", "ROUND_ROBIN", "POOLS_KNOCKOUT"],
    { error: "Choose a draw format" },
  ),
});

const gameFormatSchema = z.object({
  gamesPerMatch: z.coerce
    .number()
    .refine((n) => (ALLOWED_GAMES_PER_MATCH as readonly number[]).includes(n), {
      error: `Choose ${ALLOWED_GAMES_PER_MATCH.slice(0, -1).join(", ")} or ${ALLOWED_GAMES_PER_MATCH.at(-1)} games per match`,
    }),
  pointsPerGame: z.coerce
    .number()
    .int("Points per game must be a whole number")
    .min(MIN_POINTS_PER_GAME, `Games must go to at least ${MIN_POINTS_PER_GAME} points`)
    .max(MAX_POINTS_PER_GAME, `Games can go to at most ${MAX_POINTS_PER_GAME} points`),
});

type ParsedGameFormats =
  | {
      ok: true;
      data: {
        gamesPerMatch: number;
        pointsPerGame: number;
        knockoutGamesPerMatch: number | null;
        knockoutPointsPerGame: number | null;
      };
    }
  | { ok: false; error: string };

/**
 * Reads the game format from the form. Pools+knockout has two: the main pair
 * is the pool stage, the knockout* pair is the knockout stage. Every other
 * draw format has just the one, so the knockout pair is cleared (null).
 */
function parseGameFormats(formData: FormData, drawFormat: string): ParsedGameFormats {
  const isPools = drawFormat === "POOLS_KNOCKOUT";
  const main = gameFormatSchema.safeParse({
    gamesPerMatch: formData.get("gamesPerMatch"),
    pointsPerGame: formData.get("pointsPerGame"),
  });
  if (!main.success) {
    const message = main.error.issues[0]?.message ?? "Invalid game format";
    return { ok: false, error: isPools ? `Pool stage: ${message}` : message };
  }
  if (!isPools) {
    return { ok: true, data: { ...main.data, knockoutGamesPerMatch: null, knockoutPointsPerGame: null } };
  }

  const knockout = gameFormatSchema.safeParse({
    gamesPerMatch: formData.get("knockoutGamesPerMatch"),
    pointsPerGame: formData.get("knockoutPointsPerGame"),
  });
  if (!knockout.success) {
    return { ok: false, error: `Knockout stage: ${knockout.error.issues[0]?.message ?? "Invalid game format"}` };
  }
  return {
    ok: true,
    data: {
      ...main.data,
      knockoutGamesPerMatch: knockout.data.gamesPerMatch,
      knockoutPointsPerGame: knockout.data.pointsPerGame,
    },
  };
}

async function requireOwnedTournament(tournamentId: string, userId: string) {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
  });
  if (!tournament || tournament.organizerId !== userId) {
    return null;
  }
  return tournament;
}

export async function createEvent(
  tournamentId: string,
  _prevState: EventActionState,
  formData: FormData,
): Promise<EventActionState> {
  const userId = await requireUserId();
  const tournament = await requireOwnedTournament(tournamentId, userId);
  if (!tournament) {
    return { error: "Tournament not found." };
  }

  const parsed = eventSchema.safeParse({
    name: formData.get("name"),
    category: formData.get("category"),
    drawFormat: formData.get("drawFormat"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const formats = parseGameFormats(formData, parsed.data.drawFormat);
  if (!formats.ok) return { error: formats.error };

  try {
    await prisma.event.create({
      data: { ...parsed.data, ...formats.data, tournamentId },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { error: "This tournament already has an event with that name." };
    }
    throw error;
  }

  revalidateTournament(tournament.slug);
  return {};
}

export async function updateEvent(
  eventId: string,
  _prevState: EventActionState,
  formData: FormData,
): Promise<EventActionState> {
  const userId = await requireUserId();

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { tournament: true },
  });
  if (!event || event.tournament.organizerId !== userId) {
    return { error: "Event not found." };
  }

  const parsed = eventSchema.safeParse({
    name: formData.get("name"),
    category: formData.get("category"),
    drawFormat: formData.get("drawFormat"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  if (parsed.data.category !== event.category) {
    const entryCount = await prisma.entry.count({ where: { eventId } });
    if (entryCount > 0) {
      return {
        error: `Can't change singles/doubles — this event already has ${entryCount} ${entryCount === 1 ? "entry" : "entries"}. Remove them first or create a new event instead.`,
      };
    }
  }

  if (parsed.data.drawFormat !== event.drawFormat) {
    const matchCount = await prisma.match.count({ where: { eventId } });
    if (matchCount > 0) {
      return {
        error: "Can't change the draw format — a draw has already been generated for this event.",
      };
    }
  }

  const formats = parseGameFormats(formData, parsed.data.drawFormat);
  if (!formats.ok) return { error: formats.error };

  // Changing the rules after results are in would leave those scores judged
  // by rules they weren't played under, so lock each stage once it has any.
  // Pool matches always carry a poolId; knockout matches never do.
  const isPools = event.drawFormat === "POOLS_KNOCKOUT";
  const mainChanged =
    formats.data.gamesPerMatch !== event.gamesPerMatch || formats.data.pointsPerGame !== event.pointsPerGame;
  const knockoutChanged =
    formats.data.knockoutGamesPerMatch !== event.knockoutGamesPerMatch ||
    formats.data.knockoutPointsPerGame !== event.knockoutPointsPerGame;
  if (mainChanged || knockoutChanged) {
    const scored = await prisma.match.findMany({
      where: { eventId, status: { not: null } },
      select: { poolId: true },
    });
    const mainScored = isPools ? scored.some((m) => m.poolId !== null) : scored.length > 0;
    const knockoutScored = isPools && scored.some((m) => m.poolId === null);
    if (mainChanged && mainScored) {
      return {
        error: `Can't change the game format — ${isPools ? "pool-stage " : ""}matches already have recorded results.`,
      };
    }
    if (knockoutChanged && knockoutScored) {
      return { error: "Can't change the knockout game format — knockout matches already have recorded results." };
    }
  }

  try {
    await prisma.event.update({
      where: { id: eventId },
      data: { ...parsed.data, ...formats.data },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { error: "This tournament already has an event with that name." };
    }
    throw error;
  }

  revalidateTournament(event.tournament.slug);
  return {};
}

export async function deleteEvent(eventId: string): Promise<void> {
  const userId = await requireUserId();

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { tournament: true },
  });
  if (!event || event.tournament.organizerId !== userId) {
    redirect("/organizer");
  }

  await prisma.event.delete({ where: { id: eventId } });

  revalidateTournament(event.tournament.slug);
  redirect(`/organizer/${event.tournament.slug}/events`);
}
