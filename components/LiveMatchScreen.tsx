import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { entryDisplayName } from "@/lib/playerDisplay";
import { describeGameFormat, gameFormatForMatch } from "@/lib/tournament/gameFormat";
import { formatScheduleLabel, knockoutRoundCount, stageLabel, toDateTimeLocal } from "@/lib/tournament/schedule";
import { parseCourtNumber } from "@/lib/tournament/courts";
import type { Side } from "@/lib/tournament/liveScoring";
import { LiveScorer } from "@/app/organizer/[slug]/matches/[matchId]/LiveScorer";
import { StartLiveForm } from "@/app/organizer/[slug]/matches/[matchId]/StartLiveForm";
import { MatchRefereePanel } from "@/components/MatchRefereePanel";

/** Everything the live scoring screen (and a manual result form beside it) needs about a match. */
export const liveMatchInclude = {
  pool: true,
  event: {
    include: {
      tournament: { select: { slug: true, courtCount: true } },
      matches: { select: { poolId: true, round: true } },
    },
  },
  entry1: { include: { players: { include: { user: true } } } },
  entry2: { include: { players: { include: { user: true } } } },
  winner: { include: { players: { include: { user: true } } } },
  games: { orderBy: { gameNumber: "asc" } },
  points: { orderBy: { seq: "asc" }, select: { side: true } },
  referee: { include: { user: { select: { name: true } } } },
} satisfies Prisma.MatchInclude;

export type LiveMatch = Prisma.MatchGetPayload<{ include: typeof liveMatchInclude }>;

/**
 * The scoring screen for one match: its heading, then the start form (court
 * and first server) or the live scorer. Shared by the organizer's and the
 * referee's routes, which differ only in where "back" goes.
 */
export function LiveMatchScreen({
  match,
  backHref,
  backLabel,
  manualHref,
  resultMessage,
  viewer,
  referees,
}: {
  match: LiveMatch;
  /** Who's looking: the organizer can assign the referee here; a referee is told they are one. */
  viewer: "organizer" | "referee";
  /** The tournament's referee list, for the organizer's assignment control. */
  referees: { id: string; name: string }[];
  backHref: string;
  backLabel: string;
  /** Where a walkover or retirement is entered, if not on this page. */
  manualHref: string | null;
  /** Shown instead of the scorer once the match has a result. */
  resultMessage: string;
}) {
  const slug = match.event.tournament.slug;
  const cannotScore = !match.event.drawPublished
    ? "The draw for this event hasn't been published yet, so its matches can't be scored."
    : match.isBye || !match.entry1 || !match.entry2
      ? "This match doesn't have two players yet — it can be scored once the earlier rounds are decided."
      : match.status !== null
        ? resultMessage
        : null;

  const format = gameFormatForMatch(match.event, match);
  const stage = stageLabel(
    { poolName: match.pool?.name ?? null, round: match.round },
    { drawFormat: match.event.drawFormat, knockoutRounds: knockoutRoundCount(match.event.matches) },
  );
  const schedule = formatScheduleLabel(match);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link href={backHref} className="text-sm underline">
          ← {backLabel}
        </Link>
        <h2 className="mt-2 text-lg font-semibold">
          {match.entry1 ? entryDisplayName(match.entry1) : "TBD"} <span className="text-muted">vs</span>{" "}
          {match.entry2 ? entryDisplayName(match.entry2) : "TBD"}
        </h2>
        <p className="text-sm text-muted">
          {match.event.name} · {stage} · {describeGameFormat(format)}
          {schedule ? ` · ${schedule}` : ""}
        </p>
      </div>

      {!cannotScore && viewer === "organizer" && (
        // Assigning comes first: open while the match hasn't started, tucked away once it's live.
        <MatchRefereePanel
          matchId={match.id}
          currentRefereeId={match.refereeId}
          refereeName={match.referee?.user.name ?? null}
          referees={referees}
          defaultOpen={match.liveStartedAt === null}
        />
      )}

      {cannotScore ? (
        <p className="rounded-md border border-border px-4 py-3 text-sm text-muted">
          {cannotScore}
        </p>
      ) : match.liveStartedAt === null || match.firstServer === null ? (
        <StartLiveForm
          matchId={match.id}
          names={[entryDisplayName(match.entry1!), entryDisplayName(match.entry2!)]}
          courtCount={match.event.tournament.courtCount}
          defaultCourt={parseCourtNumber(match.court)}
          viewer={viewer}
          refereeName={match.referee?.user.name ?? null}
        />
      ) : (
        <LiveScorer
          key={match.liveStartedAt.getTime()}
          matchId={match.id}
          names={[entryDisplayName(match.entry1!), entryDisplayName(match.entry2!)]}
          format={format}
          firstServer={match.firstServer as Side}
          initialPoints={match.points.map((p) => p.side as Side)}
          backHref={backHref}
          backLabel={backLabel}
          manualHref={manualHref}
          courtNumber={parseCourtNumber(match.court)}
          courtCount={match.event.tournament.courtCount}
          courtDisplayBase={`/t/${slug}/court`}
          startedAt={match.startedAt ? toDateTimeLocal(match.startedAt) : ""}
        />
      )}
    </div>
  );
}
