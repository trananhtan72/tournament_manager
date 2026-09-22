import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { drawFormatLabels } from "@/lib/eventLabels";
import { playerName } from "@/lib/playerDisplay";
import { Bracket, type BracketMatchView } from "@/components/Bracket";

function entryLabel(entry: { players: { guestName: string | null; user: { name: string; email: string } | null }[] }) {
  return entry.players.map((p) => playerName(p)).join(" / ");
}

export default async function PublicEventPage({
  params,
}: PageProps<"/t/[slug]/[eventId]">) {
  const { slug, eventId } = await params;

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      tournament: true,
      matches: {
        include: {
          entry1: { include: { players: { include: { user: true } } } },
          entry2: { include: { players: { include: { user: true } } } },
          winner: { include: { players: { include: { user: true } } } },
        },
        orderBy: [{ round: "asc" }, { position: "asc" }],
      },
    },
  });

  if (!event || event.tournament.slug !== slug) notFound();

  const bracketMatches: BracketMatchView[] = event.matches.map((m) => ({
    id: m.id,
    round: m.round,
    position: m.position,
    entry1Label: m.entry1 ? entryLabel(m.entry1) : null,
    entry1Seed: m.entry1?.seed ?? null,
    entry2Label: m.entry2 ? entryLabel(m.entry2) : null,
    entry2Seed: m.entry2?.seed ?? null,
    winnerLabel: m.winner ? entryLabel(m.winner) : null,
    isBye: m.isBye,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/t/${slug}`} className="text-sm underline">
          ← {event.tournament.name}
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-semibold">{event.name}</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Draw format: {drawFormatLabels[event.drawFormat]}
        </p>
      </div>

      {!event.drawPublished || bracketMatches.length === 0 ? (
        <p className="text-sm text-slate-500">The draw hasn&apos;t been published yet.</p>
      ) : (
        <Bracket matches={bracketMatches} />
      )}
    </div>
  );
}
