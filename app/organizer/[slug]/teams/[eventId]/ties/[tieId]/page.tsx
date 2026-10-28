import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireOrganizerId } from "@/lib/organizerAccess";
import { playerName } from "@/lib/playerDisplay";
import { drawFormatLabels } from "@/lib/eventLabels";
import { roundName, nextPowerOfTwo } from "@/lib/tournament/singleElimination";
import { rubbersNeededToWinTie } from "@/lib/tournament/tieFormat";
import { describeGameFormat } from "@/lib/tournament/gameFormat";
import { toScorable } from "@/lib/matchView";
import { TieLineupSlot } from "@/app/organizer/[slug]/teams/TieLineupSlot";
import { StartMatchDialog } from "@/app/organizer/[slug]/draws/StartMatchDialog";

export default async function TieDetailPage({
  params,
}: PageProps<"/organizer/[slug]/teams/[eventId]/ties/[tieId]">) {
  const { slug, eventId, tieId } = await params;
  const userId = await requireOrganizerId();

  const tie = await prisma.tie.findFirst({
    where: { id: tieId, eventId, event: { category: "TEAM", tournament: { slug, organizerId: userId } } },
    include: {
      event: {
        include: { tieFormatSlots: { orderBy: { order: "asc" } }, teams: { select: { id: true } } },
      },
      team1Entry: { include: { team: { include: { members: { include: { user: true } } } } } },
      team2Entry: { include: { team: { include: { members: { include: { user: true } } } } } },
      matches: {
        include: {
          entry1: { include: { players: { include: { user: true } } } },
          entry2: { include: { players: { include: { user: true } } } },
          winner: { include: { players: { include: { user: true } } } },
          games: { orderBy: { gameNumber: "asc" } },
        },
      },
    },
  });
  if (!tie) notFound();

  const drawPublished = tie.event.drawPublished;

  const team1 = tie.team1Entry?.team ?? null;
  const team2 = tie.team2Entry?.team ?? null;
  const slotCount = tie.event.tieFormatSlots.length;
  const needed = rubbersNeededToWinTie(slotCount);

  const wins1 = tie.matches.filter((m) => m.winnerId !== null && m.winnerId === m.entry1Id).length;
  const wins2 = tie.matches.filter((m) => m.winnerId !== null && m.winnerId === m.entry2Id).length;

  const roundLabel =
    tie.event.drawFormat === "SINGLE_ELIMINATION"
      ? roundName(tie.round, Math.log2(nextPowerOfTwo(Math.max(tie.event.teams.length, 2))))
      : "Round robin";

  const rosterOptions = (team: typeof team1) =>
    (team?.members ?? []).map((m) => ({ id: m.id, label: playerName(m) }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/organizer/${slug}/teams/${eventId}`} className="text-sm underline">
          ← Back to teams
        </Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">
            {team1?.name ?? "TBD"} vs {team2?.name ?? "TBD"}
          </h1>
          <p className="text-sm text-muted">
            {drawFormatLabels[tie.event.drawFormat]} · {roundLabel}
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold">
            {wins1} – {wins2}
          </p>
          {tie.winnerId ? (
            <p className="text-sm font-medium text-success">
              {tie.winnerId === tie.team1Id ? team1?.name : team2?.name} won the tie
            </p>
          ) : (
            <p className="text-sm text-muted">First to {needed} rubbers wins the tie</p>
          )}
        </div>
      </div>

      {(!team1 || !team2) && (
        <p className="text-sm text-muted">
          {tie.isBye ? "This tie is a bye." : "Waiting for both teams to be placed in the draw."}
        </p>
      )}

      {team1 && team2 && (
        <ul className="flex flex-col gap-4">
          {tie.event.tieFormatSlots.map((slot) => {
            const position = tie.position * 100 + (slot.order - 1);
            const match = tie.matches.find((m) => m.position === position) ?? null;
            const locked = match?.status !== null && match?.status !== undefined;
            const label1 = match?.entry1
              ? match.entry1.players.map((p) => playerName(p)).join(" / ")
              : null;
            const label2 = match?.entry2
              ? match.entry2.players.map((p) => playerName(p)).join(" / ")
              : null;

            return (
              <li key={slot.id} className="flex flex-col gap-3 rounded-md border border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-medium">
                    {slot.label} <span className="text-sm text-muted">({slot.type === "DOUBLES" ? "Doubles" : "Singles"})</span>
                  </h3>
                  <span className="text-xs text-muted">
                    {describeGameFormat({ gamesPerMatch: slot.gamesPerMatch, pointsPerGame: slot.pointsPerGame })}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-muted">{team1.name}</span>
                    <TieLineupSlot
                      key={`1-${label1}`}
                      tieId={tie.id}
                      slotOrder={slot.order}
                      side={1}
                      roster={rosterOptions(team1)}
                      neededPlayers={slot.type === "DOUBLES" ? 2 : 1}
                      currentLabel={label1}
                      locked={locked}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-muted">{team2.name}</span>
                    <TieLineupSlot
                      key={`2-${label2}`}
                      tieId={tie.id}
                      slotOrder={slot.order}
                      side={2}
                      roster={rosterOptions(team2)}
                      neededPlayers={slot.type === "DOUBLES" ? 2 : 1}
                      currentLabel={label2}
                      locked={locked}
                    />
                  </div>
                </div>

                {match && label1 && label2 && (
                  <div>
                    {match.status ? (
                      <span className="text-sm text-muted">
                        {match.winnerId === match.entry1Id ? label1 : label2} won
                      </span>
                    ) : drawPublished ? (
                      <StartMatchDialog
                        liveHref={`/organizer/${slug}/matches/${match.id}`}
                        scorable={toScorable(match, {
                          gamesPerMatch: match.gamesPerMatch!,
                          pointsPerGame: match.pointsPerGame!,
                        })}
                      >
                        <span className="text-sm underline">Score this match →</span>
                      </StartMatchDialog>
                    ) : (
                      <span className="text-sm text-muted">Publish the draw before scoring.</span>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
