import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { entryDisplayName } from "@/lib/playerDisplay";
import { formatDate } from "@/lib/formatDate";
import {
  buildScheduleGrid,
  dayKey,
  formatDayHeading,
  formatScheduleLabel,
  formatTimeOfDay,
  groupByDay,
  inferSlotMinutes,
  knockoutRoundCount,
  sortSchedule,
  stageLabel,
  toDateTimeLocal,
} from "@/lib/tournament/schedule";
import { courtName, courtNumbers } from "@/lib/tournament/courts";
import { BulkScheduleForm, type BulkScheduleEventGroup } from "@/app/organizer/[slug]/schedule/BulkScheduleForm";
import { MatchDurationForm } from "@/app/organizer/[slug]/schedule/MatchDurationForm";
import { ScheduleGridBoard, type DayGrid, type GridMatch } from "@/app/organizer/[slug]/schedule/ScheduleGridBoard";
import { resetAllSchedules } from "@/app/actions/schedule";
import { ActionForm } from "@/components/ActionForm";

const NO_COURT = "No court";

export const metadata: Metadata = { title: "Match schedule" };

export default async function OrganizerSchedulePage({
  params,
}: PageProps<"/organizer/[slug]/schedule">) {
  const { slug } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    redirect("/signin");
  }

  const tournament = await prisma.tournament.findUnique({
    where: { slug },
    include: {
      referees: { include: { user: { select: { name: true } } } },
      events: {
        orderBy: { name: "asc" },
        include: {
          pools: true,
          matches: {
            orderBy: [{ round: "asc" }, { position: "asc" }],
            include: {
              entry1: { include: { players: { include: { user: true } } } },
              entry2: { include: { players: { include: { user: true } } } },
            },
          },
        },
      },
    },
  });
  if (!tournament || tournament.organizerId !== session.user.id) {
    notFound();
  }

  const refereeChoices = tournament.referees
    .map((r) => ({ id: r.id, name: r.user.name }))
    .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
  const firstDay = dayKey(tournament.startDate);
  const lastDay = dayKey(tournament.endDate);

  type FlatMatch = {
    matchId: string;
    eventName: string;
    stage: string;
    label: string;
    court: string | null;
    scheduledAt: Date | null;
    refereeId: string | null;
    round: number;
    position: number;
    draftDraw: boolean;
  };

  const schedulableByEvent: BulkScheduleEventGroup[] = [];
  const flatMatches: FlatMatch[] = [];

  for (const event of tournament.events) {
    const knockoutRounds = knockoutRoundCount(event.matches);
    const poolNames = new Map(event.pools.map((p) => [p.id, p.name]));
    const stageFor = (match: { poolId: string | null; round: number }) =>
      stageLabel(
        { poolName: match.poolId ? (poolNames.get(match.poolId) ?? null) : null, round: match.round },
        { drawFormat: event.drawFormat, knockoutRounds },
      );
    const schedulableMatches = event.matches.filter((m) => !m.isBye && m.status === null);
    if (schedulableMatches.length === 0) continue;

    schedulableByEvent.push({
      eventId: event.id,
      eventName: event.name,
      matches: schedulableMatches.map((m) => ({
        id: m.id,
        stage: stageFor(m),
        label: `${m.entry1 ? entryDisplayName(m.entry1) : "TBD"} vs ${m.entry2 ? entryDisplayName(m.entry2) : "TBD"}`,
        currentTime: formatScheduleLabel({
          scheduledAt: m.scheduledAt,
          court: m.court,
          status: m.status,
          liveStartedAt: m.liveStartedAt,
        }),
      })),
    });

    for (const m of schedulableMatches) {
      flatMatches.push({
        matchId: m.id,
        eventName: event.name,
        stage: stageFor(m),
        label: `${m.entry1 ? entryDisplayName(m.entry1) : "TBD"} vs ${m.entry2 ? entryDisplayName(m.entry2) : "TBD"}`,
        court: m.court,
        scheduledAt: m.scheduledAt,
        refereeId: m.refereeId,
        round: m.round,
        position: m.position,
        draftDraw: !event.drawPublished,
      });
    }
  }

  const allNonByeMatches = tournament.events.flatMap((e) => e.matches.filter((m) => !m.isBye));
  const scheduledCount = allNonByeMatches.filter((m) => m.scheduledAt !== null).length;
  const hasAnyMatches = allNonByeMatches.length > 0;

  const timed = flatMatches.filter(
    (m): m is FlatMatch & { scheduledAt: Date } => m.scheduledAt !== null,
  );
  const untimed = flatMatches
    .filter((m) => m.scheduledAt === null)
    .sort(
      (a, b) =>
        a.eventName.localeCompare(b.eventName, "en", { numeric: true }) || a.round - b.round || a.position - b.position,
    );

  const toGridMatch = (m: FlatMatch): GridMatch => ({
    matchId: m.matchId,
    eventName: m.eventName,
    stage: m.stage,
    label: m.label,
    initialScheduledAt: m.scheduledAt ? toDateTimeLocal(m.scheduledAt) : "",
    initialCourt: m.court ?? "",
    refereeId: m.refereeId,
    draftDraw: m.draftDraw,
  });

  const allMatches: GridMatch[] = flatMatches.map(toGridMatch);
  const knownCourts = courtNumbers(tournament.courtCount).map(courtName);

  const days: DayGrid[] = groupByDay(sortSchedule(timed)).map((day) => {
    const slotMinutes = inferSlotMinutes(day.items);
    const grid = buildScheduleGrid(
      day.items.map((m) => ({ matchId: m.matchId, scheduledAt: m.scheduledAt, court: m.court ?? NO_COURT })),
      knownCourts,
      slotMinutes,
    );
    return {
      day: day.day,
      heading: formatDayHeading(day.date),
      courts: grid.courts,
      rows: grid.rows.map((rowDate) => ({ label: formatTimeOfDay(rowDate), value: toDateTimeLocal(rowDate) })),
      cells: Object.fromEntries(grid.cellsByKey),
    };
  });
  const unscheduled = untimed.map((m) => m.matchId);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href={`/organizer/${slug}/matches`} className="text-sm underline">
          ← Match center
        </Link>
        <Link href={`/t/${slug}/matches`} className="text-sm underline">
          View public matches
        </Link>
      </div>

      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Match schedule</h1>
        <p className="text-sm text-muted">
          Give each match a start time and, if you like, a court. Times are local to the venue
          ({formatDate(tournament.startDate)} – {formatDate(tournament.endDate)}). Players see the
          schedule once an event&apos;s draw is published.
        </p>
        {allNonByeMatches.length > 0 && (
          <p className="text-sm text-muted">
            {scheduledCount} of {allNonByeMatches.length} matches scheduled.
          </p>
        )}
      </div>

      {hasAnyMatches && (
        <section className="flex flex-col gap-4 rounded-lg border border-border p-4">
          <div className="flex flex-col gap-2 border-b border-border pb-4">
            <h2 className="text-lg font-semibold">Match duration</h2>
            <p className="text-sm text-muted">
              One length for every match in the tournament, so different batches scheduled at different
              times never end up out of sync with each other.
            </p>
            <MatchDurationForm tournamentId={tournament.id} initialMinutes={tournament.matchDurationMinutes} />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Schedule or reschedule a day</h2>
            <p className="text-sm text-muted">
              Pick a date and start time, then check which matches play that day — each one gets a time
              and a court, spread evenly across your {tournament.courtCount} court
              {tournament.courtCount === 1 ? "" : "s"} (lower-numbered courts filled first). Already-scheduled
              matches are listed too, so you can select them again to revise the plan.
            </p>
          </div>
          <BulkScheduleForm
            tournamentId={tournament.id}
            events={schedulableByEvent}
            firstDay={firstDay}
            lastDay={lastDay}
          />
          {scheduledCount > 0 && (
            <div className="flex items-center gap-3 border-t border-border pt-4">
              <p className="text-sm text-muted">Want to throw out the whole plan and start over?</p>
              <ActionForm
                action={resetAllSchedules.bind(null, tournament.id)}
                label="Unschedule all matches"
                variant="danger"
                pendingLabel="Unscheduling…"
                confirmMessage={`Clear the time and court for all ${scheduledCount} scheduled match${scheduledCount === 1 ? "" : "es"}? This can't be undone — you'll need to re-export or set times individually afterward.`}
              />
            </div>
          )}
        </section>
      )}

      {hasAnyMatches ? (
        <ScheduleGridBoard
          tournamentId={tournament.id}
          days={days}
          unscheduled={unscheduled}
          matches={allMatches}
          courtCount={tournament.courtCount}
          firstDay={firstDay}
          lastDay={lastDay}
          refereeChoices={refereeChoices}
        />
      ) : (
        <p className="text-sm text-muted">
          There are no matches to schedule yet. Generate a draw for an event first.
        </p>
      )}
    </div>
  );
}
