import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { drawFormatLabels } from "@/lib/eventLabels";
import { SimpleTable } from "@/components/SimpleTable";
import { tournamentTabMetadata } from "@/lib/tournamentMetadata";
import { drawSize, drawStage } from "@/lib/tournament/drawSummary";

export function generateMetadata({ params }: PageProps<"/t/[slug]/draws">): Promise<Metadata> {
  return tournamentTabMetadata(params, "Draws");
}

export default async function DrawsTab({ params }: PageProps<"/t/[slug]/draws">) {
  const { slug } = await params;

  const tournament = await prisma.tournament.findUnique({
    where: { slug },
    include: {
      events: {
        orderBy: { name: "asc" },
        include: {
          _count: { select: { entries: { where: { status: "CONFIRMED" } } } },
          matches: {
            select: { poolId: true, round: true, isBye: true, winnerId: true, entry1Id: true, entry2Id: true },
          },
        },
      },
    },
  });
  if (!tournament) notFound();

  if (tournament.events.length === 0) {
    return <p className="text-sm text-slate-500">No events have been added yet.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <SimpleTable
        columns={[{ label: "Draw" }, { label: "Size", align: "right" }, { label: "Type" }, { label: "Stage" }]}
        rows={tournament.events.map((event) => {
          // A draft draw is the organizer's private work in progress.
          const published = event.drawPublished && event.matches.length > 0;
          return {
            key: event.id,
            cells: [
              published ? (
                <Link key="draw" href={`/t/${slug}/${event.id}`} className="font-medium underline">
                  {event.name}
                </Link>
              ) : (
                <span key="draw" className="font-medium">
                  {event.name}
                </span>
              ),
              published ? drawSize(event.drawFormat, event.matches) : event._count.entries,
              drawFormatLabels[event.drawFormat],
              published ? (
                drawStage(event.drawFormat, event.matches)
              ) : (
                <span key="stage" className="text-slate-500">
                  Not published yet
                </span>
              ),
            ],
          };
        })}
      />
      <p className="text-xs text-slate-500">
        Size is the number of entries in the draw. Until a draw is published it shows the confirmed entries so far.
      </p>
    </div>
  );
}
