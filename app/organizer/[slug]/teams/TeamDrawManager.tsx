import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { drawFormatLabels } from "@/lib/eventLabels";
import { Bracket, MatchCard, type BracketMatchView } from "@/components/Bracket";
import { ActionForm } from "@/components/ActionForm";
import { publishDraw, unpublishDraw } from "@/app/actions/draws";
import { GenerateDrawForm } from "@/app/organizer/[slug]/draws/GenerateDrawForm";
import { computeRoundRobinStandings } from "@/lib/tournament/roundRobin";

export const teamDrawEventInclude = {
  teams: { select: { id: true, name: true, entryId: true } },
  ties: { orderBy: [{ round: "asc" }, { position: "asc" }] },
} satisfies Prisma.EventInclude;

export type TeamDrawEvent = Prisma.EventGetPayload<{ include: typeof teamDrawEventInclude }>;

/** Everything about a team event's draw: generate, publish, and view it. Mirrors EventDrawManager, trimmed to what teams need in v1 (no manual draw, no swap/move — ties are always fully seeded on generation). */
export function TeamDrawManager({
  event,
  slug,
}: {
  event: TeamDrawEvent;
  slug: string;
}) {
  const nameByEntryId = new Map(event.teams.filter((t) => t.entryId).map((t) => [t.entryId!, t.name]));
  const teamLabel = (entryId: string | null) => (entryId ? nameByEntryId.get(entryId) ?? "Unknown team" : null);
  const tieHref = (tieId: string) => `/organizer/${slug}/teams/${event.id}/ties/${tieId}`;

  const unpublishWithId = unpublishDraw.bind(null, event.id);
  const publishWithId = publishDraw.bind(null, event.id);

  const bracketMatches: BracketMatchView[] = event.ties.map((t) => ({
    id: t.id,
    round: t.round,
    position: t.position,
    entry1Label: teamLabel(t.team1Id),
    entry1Seed: null,
    entry2Label: teamLabel(t.team2Id),
    entry2Seed: null,
    winnerLabel: teamLabel(t.winnerId),
    isBye: t.isBye,
    status: null,
    games: [],
    gamesPerMatch: 0,
  }));

  const renderTieCard = (match: BracketMatchView) =>
    match.isBye ? (
      <MatchCard key={match.id} match={match} />
    ) : (
      <Link key={match.id} href={tieHref(match.id)}>
        <MatchCard match={match} interactive />
      </Link>
    );

  const standings =
    event.drawFormat === "ROUND_ROBIN"
      ? computeRoundRobinStandings(
          event.teams.filter((t) => t.entryId).map((t) => t.entryId!),
          event.ties
            .filter((t): t is typeof t & { team1Id: string; team2Id: string } => t.team1Id !== null && t.team2Id !== null)
            .map((t) => ({ entry1Id: t.team1Id, entry2Id: t.team2Id, winnerId: t.winnerId, games: [] })),
        )
      : [];

  return (
    <section
      id={`draw-${event.id}`}
      className="flex scroll-mt-4 flex-col gap-4 rounded-lg border border-border p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">{event.name}</h2>
          <p className="text-sm text-muted">
            {drawFormatLabels[event.drawFormat]} · {event.teams.length} {event.teams.length === 1 ? "team" : "teams"}
          </p>
        </div>
        {event.drawPublished ? (
          <span className="rounded-full bg-success/15 px-3 py-1 text-xs font-medium text-success">Published</span>
        ) : (
          <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-medium text-muted">
            Not published
          </span>
        )}
      </div>

      {bracketMatches.length === 0 ? (
        <p className="text-sm text-muted">
          No draw yet. Generate the draw once your teams are confirmed (4–64 for knockout, 3+ for round robin).
        </p>
      ) : event.drawFormat === "SINGLE_ELIMINATION" ? (
        <Bracket matches={bracketMatches} renderMatch={renderTieCard} />
      ) : (
        <>
          <ul className="flex flex-wrap gap-3">{bracketMatches.map(renderTieCard)}</ul>
          {standings.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[20rem] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted">
                    <th className="py-2 pr-2 font-medium">#</th>
                    <th className="py-2 pr-2 font-medium">Team</th>
                    <th className="py-2 pr-2 text-right font-medium">P</th>
                    <th className="py-2 text-right font-medium">W-L</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((row) => (
                    <tr key={row.entryId} className="border-b border-border last:border-b-0">
                      <td className="py-2 pr-2 text-muted">{row.rank}</td>
                      <td className="py-2 pr-2 font-medium text-text">{nameByEntryId.get(row.entryId) ?? "Unknown"}</td>
                      <td className="py-2 pr-2 text-right text-muted">{row.played}</td>
                      <td className="py-2 text-right text-muted">
                        {row.wins}-{row.losses}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {!event.drawPublished && <GenerateDrawForm eventId={event.id} hasExistingDraw={bracketMatches.length > 0} />}
        {bracketMatches.length > 0 && !event.drawPublished && (
          <ActionForm
            action={publishWithId}
            variant="primary"
            label="Publish draw"
            pendingLabel="Publishing…"
            confirmMessage="Publish this draw? Teams will be able to see it, and it can no longer be regenerated."
          />
        )}
        {event.drawPublished && (
          <ActionForm
            action={unpublishWithId}
            variant="secondary"
            label="Unpublish"
            pendingLabel="Unpublishing…"
            confirmMessage="Unpublish this draw so you can make changes and regenerate it?"
          />
        )}
      </div>
    </section>
  );
}
