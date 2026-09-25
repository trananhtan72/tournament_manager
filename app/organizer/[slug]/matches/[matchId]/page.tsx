import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireOrganizerId } from "@/lib/organizerAccess";
import { LiveMatchScreen, liveMatchInclude } from "@/components/LiveMatchScreen";

export default async function LiveScoringPage({
  params,
}: PageProps<"/organizer/[slug]/matches/[matchId]">) {
  const { slug, matchId } = await params;
  const userId = await requireOrganizerId();

  const match = await prisma.match.findFirst({
    where: { id: matchId, event: { tournament: { slug, organizerId: userId } } },
    include: liveMatchInclude,
  });
  if (!match) notFound();

  const referees = (
    await prisma.tournamentReferee.findMany({
      where: { tournamentId: match.event.tournamentId },
      include: { user: { select: { name: true } } },
    })
  )
    .map((r) => ({ id: r.id, name: r.user.name }))
    .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));

  const back = `/organizer/${slug}/matches`;
  return (
    <LiveMatchScreen
      match={match}
      backHref={back}
      backLabel="Match center"
      manualHref={back}
      resultMessage="This match already has a result. Edit it from the Match center."
      viewer="organizer"
      referees={referees}
    />
  );
}
