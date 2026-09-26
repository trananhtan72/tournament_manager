import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { LiveMatchScreen, liveMatchInclude } from "@/components/LiveMatchScreen";
import { MatchResultForm } from "@/app/organizer/[slug]/matches/MatchResultForm";
import { toScorable } from "@/lib/matchView";
import { gameFormatForMatch } from "@/lib/tournament/gameFormat";

export const metadata: Metadata = { title: "Referee a match" };

export default async function RefereeMatchPage({ params }: PageProps<"/referee/matches/[matchId]">) {
  const { matchId } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  // Only the referee assigned to this match can open it (the organizer uses the organizer console).
  const match = await prisma.match.findFirst({
    where: { id: matchId, referee: { userId: session.user.id } },
    include: liveMatchInclude,
  });
  if (!match) notFound();

  const ready = match.event.drawPublished && match.entry1 !== null && match.entry2 !== null;
  const scorable = ready ? toScorable(match, gameFormatForMatch(match.event, match)) : null;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
      <LiveMatchScreen
        match={match}
        backHref="/referee"
        backLabel="My matches"
        manualHref={null}
        resultMessage="The result has been saved. Only the organizer can change it."
        viewer="referee"
        referees={[]}
      />

      {scorable && match.status === null && (
        <details className="rounded-md border border-border px-4 py-3 text-sm">
          <summary className="cursor-pointer font-medium">
            Walkover, retirement, or enter the full result instead
          </summary>
          <div className="pt-3">
            <MatchResultForm key={`${match.id}:${match.status}`} {...scorable} allowEdit={false} />
          </div>
        </details>
      )}

      {scorable && match.status !== null && (
        <MatchResultForm key={`${match.id}:${match.status}:${match.winnerId}`} {...scorable} allowEdit={false} />
      )}
    </div>
  );
}
