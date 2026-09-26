import { redirect } from "next/navigation";
import Link from "next/link";
import type { EntryStatus } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { withdrawalIsOpen } from "@/lib/registrationDeadline";
import { ActionForm } from "@/components/ActionForm";
import { playerName } from "@/lib/playerDisplay";
import { MatchCard } from "@/components/Bracket";
import { toBracketMatchView } from "@/lib/matchView";
import { AutoRefresh } from "@/components/AutoRefresh";
import { isLiveMatch, loadLiveStates } from "@/lib/liveMatches";
import { gameFormatForMatch } from "@/lib/tournament/gameFormat";
import { formatScheduleLabel, formatStartedLabel, knockoutRoundCount, sortSchedule, stageLabel } from "@/lib/tournament/schedule";
import {
  confirmPartnerInvite,
  declinePartnerInvite,
  withdrawEntry,
} from "@/app/actions/entries";

function entryStatusText(
  status: EntryStatus,
  myRole: "INITIATOR" | "PARTNER",
  otherPlayerName: string | undefined,
): string {
  switch (status) {
    case "CONFIRMED":
      return otherPlayerName ? `Registered with ${otherPlayerName}` : "Registered";
    case "PENDING_APPROVAL":
      return otherPlayerName
        ? `Registered with ${otherPlayerName} — waiting for the organizer's approval`
        : "Registered — waiting for the organizer's approval";
    case "NEEDS_PARTNER":
      return "Waiting for the organizer to pair you with a partner";
    case "PENDING_PARTNER":
      return myRole === "INITIATOR"
        ? `Invitation sent to ${otherPlayerName ?? "your partner"} — awaiting confirmation`
        : "Waiting on your response";
  }
}

type MyMatchRow = {
  match: {
    id: string;
    eventId: string;
    scheduledAt: Date | null;
    court: string | null;
    startedAt: Date | null;
    status: string | null;
    event: { name: string; tournament: { name: string; slug: string } };
  };
  stage: string;
  view: React.ComponentProps<typeof MatchCard>["match"];
};

function MyMatchItem({ row, emptyTimeLabel }: { row: MyMatchRow; emptyTimeLabel: string | null }) {
  const { match, stage, view } = row;
  const timeLabel = (match.status !== null ? formatStartedLabel(match.startedAt) : null) ?? formatScheduleLabel(match) ?? emptyTimeLabel;
  return (
    <li className="flex flex-col gap-2 rounded-md border border-border px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex min-w-0 flex-col gap-0.5 text-sm sm:w-64">
        <Link href={`/t/${match.event.tournament.slug}/${match.eventId}`} className="font-medium underline">
          {match.event.name}
        </Link>
        <span className="text-muted">
          {match.event.tournament.name} · {stage}
        </span>
        {timeLabel && <span className="text-text">{timeLabel}</span>}
      </div>
      <MatchCard match={view} />
    </li>
  );
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/signin");
  }
  const userId = session.user.id;

  const entryPlayers = await prisma.entryPlayer.findMany({
    where: { userId },
    include: {
      entry: {
        include: {
          event: { include: { tournament: true } },
          players: { include: { user: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Matches in published draws that one of my entries plays in (byes aren't matches).
  const myMatchRecords = await prisma.match.findMany({
    where: {
      isBye: false,
      event: { drawPublished: true },
      OR: [
        { entry1: { players: { some: { userId } } } },
        { entry2: { players: { some: { userId } } } },
      ],
    },
    include: {
      pool: true,
      event: { include: { tournament: true, matches: { select: { poolId: true, round: true } } } },
      entry1: { include: { players: { include: { user: true } } } },
      entry2: { include: { players: { include: { user: true } } } },
      winner: { include: { players: { include: { user: true } } } },
      games: { orderBy: { gameNumber: "asc" } },
    },
  });
  const liveStates = await loadLiveStates(myMatchRecords, (m) => gameFormatForMatch(m.event, m));
  const myMatches = myMatchRecords.map((match) => ({
    match,
    stage: stageLabel(
      { poolName: match.pool?.name ?? null, round: match.round },
      { drawFormat: match.event.drawFormat, knockoutRounds: knockoutRoundCount(match.event.matches) },
    ),
    view: toBracketMatchView(match, gameFormatForMatch(match.event, match), {
      showSchedule: false,
      live: liveStates.get(match.id) ?? null,
    }),
  }));
  const upcomingMatches = myMatches.filter((r) => r.match.status === null);
  // Timed matches first in play order, then the ones still waiting for a slot.
  const upcomingTimed = sortSchedule(
    upcomingMatches.flatMap((r) =>
      r.match.scheduledAt
        ? [{ ...r, scheduledAt: r.match.scheduledAt, court: r.match.court, eventName: r.match.event.name, round: r.match.round, position: r.match.position }]
        : [],
    ),
  );
  const upcomingUntimed = upcomingMatches
    .filter((r) => !r.match.scheduledAt)
    .sort(
      (a, b) =>
        a.match.event.tournament.name.localeCompare(b.match.event.tournament.name) ||
        a.match.event.name.localeCompare(b.match.event.name) ||
        a.match.round - b.match.round ||
        a.match.position - b.match.position,
    );
  const playedMatches = myMatches
    .filter((r) => r.match.status !== null)
    .sort((a, b) => b.match.updatedAt.getTime() - a.match.updatedAt.getTime());

  const pendingInvites = entryPlayers.filter(
    (ep) => ep.role === "PARTNER" && !ep.confirmed,
  );
  const myRegistrations = entryPlayers.filter(
    (ep) => !(ep.role === "PARTNER" && !ep.confirmed),
  );

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
      <AutoRefresh intervalMs={myMatchRecords.some(isLiveMatch) ? 6000 : null} />
      <h1 className="text-xl font-semibold">Dashboard</h1>

      {pendingInvites.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Needs your response</h2>
          <ul className="flex flex-col gap-3">
            {pendingInvites.map((ep) => {
              const initiator = ep.entry.players.find((p) => p.role === "INITIATOR");
              return (
                <li
                  key={ep.id}
                  className="flex flex-col gap-2 rounded-md border border-border px-4 py-3"
                >
                  <div>
                    <Link
                      href={`/t/${ep.entry.event.tournament.slug}`}
                      className="font-medium underline"
                    >
                      {ep.entry.event.tournament.name}
                    </Link>
                    <span className="text-sm text-muted">
                      {" "}
                      · {ep.entry.event.name}
                    </span>
                  </div>
                  <p className="text-sm text-muted">
                    {initiator ? playerName(initiator) : "Someone"} invited you to be their
                    partner.
                  </p>
                  <div className="flex gap-2">
                    <ActionForm
                      action={confirmPartnerInvite.bind(null, ep.entry.id)}
                      variant="primary"
                      label="Accept"
                      pendingLabel="Accepting…"
                    />
                    <ActionForm
                      action={declinePartnerInvite.bind(null, ep.entry.id)}
                      variant="secondary"
                      label="Decline"
                      pendingLabel="Declining…"
                      confirmMessage="Decline this partner invitation?"
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">My registrations</h2>
        {myRegistrations.length === 0 ? (
          <p className="text-sm text-muted">
            You haven&apos;t registered for any events yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {myRegistrations.map((ep) => {
              const other = ep.entry.players.find((p) => p.userId !== userId);
              const withdrawalOpen = withdrawalIsOpen(ep.entry.event.tournament);
              return (
                <li
                  key={ep.id}
                  className="flex flex-col gap-2 rounded-md border border-border px-4 py-3"
                >
                  <div>
                    <Link
                      href={`/t/${ep.entry.event.tournament.slug}`}
                      className="font-medium underline"
                    >
                      {ep.entry.event.tournament.name}
                    </Link>
                    <span className="text-sm text-muted">
                      {" "}
                      · {ep.entry.event.name}
                    </span>
                  </div>
                  <p className="text-sm text-muted">
                    {entryStatusText(ep.entry.status, ep.role, other ? playerName(other) : undefined)}
                  </p>
                  {withdrawalOpen && ep.entry.event.drawPublished && (
                    <p className="text-sm text-muted">
                      The draw has been published — contact the organizer if you need to withdraw.
                    </p>
                  )}
                  {withdrawalOpen && !ep.entry.event.drawPublished && (
                    <div>
                      <ActionForm
                        action={withdrawEntry.bind(null, ep.entry.id)}
                        variant="secondary"
                        label={
                          ep.entry.status === "PENDING_PARTNER" && ep.role === "INITIATOR"
                            ? "Cancel invitation"
                            : "Withdraw"
                        }
                        pendingLabel="Withdrawing…"
                        confirmMessage="Withdraw from this event? This cannot be undone."
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-4 border-t border-border pt-6">
        <h2 className="text-lg font-semibold">My matches</h2>
        {myMatches.length === 0 ? (
          <p className="text-sm text-muted">
            Your matches will appear here once a draw you&apos;re in is published.
          </p>
        ) : (
          <>
            {(upcomingTimed.length > 0 || upcomingUntimed.length > 0) && (
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold text-text">Upcoming</h3>
                <ul className="flex flex-col gap-2">
                  {upcomingTimed.map((r) => (
                    <MyMatchItem key={r.match.id} row={r} emptyTimeLabel={null} />
                  ))}
                  {upcomingUntimed.map((r) => (
                    <MyMatchItem key={r.match.id} row={r} emptyTimeLabel="Time to be announced" />
                  ))}
                </ul>
              </div>
            )}
            {playedMatches.length > 0 && (
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold text-text">Results</h3>
                <ul className="flex flex-col gap-2">
                  {playedMatches.map((r) => (
                    <MyMatchItem key={r.match.id} row={r} emptyTimeLabel={null} />
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
