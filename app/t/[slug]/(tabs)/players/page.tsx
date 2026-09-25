import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { tournamentTabMetadata } from "@/lib/tournamentMetadata";
import { buildPlayerDirectory } from "@/lib/tournament/playerDirectory";
import { PlayersList } from "@/app/t/[slug]/(tabs)/players/PlayersList";

export function generateMetadata({ params }: PageProps<"/t/[slug]/players">): Promise<Metadata> {
  return tournamentTabMetadata(params, "Players");
}

export default async function PlayersTab({ params }: PageProps<"/t/[slug]/players">) {
  const { slug } = await params;

  const tournament = await prisma.tournament.findUnique({
    where: { slug },
    include: {
      events: {
        include: {
          // Only confirmed entries are official; pending and unpaired registrations aren't listed.
          entries: {
            where: { status: "CONFIRMED" },
            include: { players: { include: { user: { select: { name: true } } } } },
          },
        },
      },
    },
  });
  if (!tournament) notFound();

  // Names only: emails stay private to the organizer.
  const players = buildPlayerDirectory(
    tournament.events.flatMap((event) =>
      event.entries.map((entry) => ({ eventName: event.name, players: entry.players })),
    ),
  );

  if (players.length === 0) {
    return <p className="text-sm text-slate-500">No players have been confirmed yet.</p>;
  }

  return <PlayersList players={players} />;
}
