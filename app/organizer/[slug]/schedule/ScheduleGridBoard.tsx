"use client";

import { useMemo, useState, useTransition } from "react";
import { moveMatchOnGrid } from "@/app/actions/schedule";
import { MatchScheduleForm } from "@/app/organizer/[slug]/schedule/MatchScheduleForm";
import { MatchRefereeForm } from "@/app/organizer/[slug]/referees/MatchRefereeForm";
import { Button } from "@/components/Button";
import { FormError } from "@/components/FormError";

/** Matches `lib/tournament/schedule.ts`'s courtColumns/buildScheduleGrid convention for a court-less slot. */
const NO_COURT = "No court";

export type GridMatch = {
  matchId: string;
  eventName: string;
  stage: string;
  label: string;
  /** "YYYY-MM-DDTHH:mm" for the time-edit form, or "" when unscheduled. */
  initialScheduledAt: string;
  initialCourt: string;
  refereeId: string | null;
  /** The event's draw isn't published yet — players can't see this match. */
  draftDraw: boolean;
};

export type DayGrid = {
  day: string;
  heading: string;
  /** Column labels, in display order. */
  courts: string[];
  /** Row i's time label/value pairs, in order. */
  rows: { label: string; value: string }[];
  /** `${rowIndex}:${court}` → match ids in that cell (almost always 0 or 1). */
  cells: Record<string, readonly string[]>;
};

/**
 * The match schedule as a time-by-court grid: every match at the same time
 * lines up in the same row across every court, with empty space standing in
 * for a gap rather than the columns collapsing around it. Dragging a card
 * onto an empty cell gives it that time and court immediately (no separate
 * save step); dropping it on an occupied cell swaps the two — or, if the
 * dragged card was still unscheduled, simply bumps the occupant back to
 * Unscheduled, since there's nothing of its own to swap back. The
 * "Unscheduled" list below is itself a valid drop target too, for pulling a
 * match off the grid entirely.
 */
export function ScheduleGridBoard({
  tournamentId,
  days,
  unscheduled,
  matches,
  courtCount,
  firstDay,
  lastDay,
  refereeChoices,
}: {
  tournamentId: string;
  days: DayGrid[];
  unscheduled: string[];
  matches: GridMatch[];
  courtCount: number;
  firstDay: string;
  lastDay: string;
  refereeChoices: { id: string; name: string }[];
}) {
  const matchesById = useMemo(() => new Map(matches.map((m) => [m.matchId, m])), [matches]);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>();
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const move = (matchId: string, target: { scheduledAt: string | null; court: string | null }) => {
    if (isPending) return;
    setError(undefined);
    startTransition(async () => {
      const result = await moveMatchOnGrid(tournamentId, matchId, target);
      if (result?.error) setError(result.error);
    });
  };

  const dropHandlers = (onDrop: (draggedId: string) => void) => ({
    onDragOver: (e: React.DragEvent) => e.preventDefault(),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      const draggedId = e.dataTransfer.getData("text/plain");
      if (draggedId) onDrop(draggedId);
    },
  });

  const dragHandlers = (matchId: string) => ({
    draggable: !isPending,
    onDragStart: (e: React.DragEvent) => {
      e.dataTransfer.setData("text/plain", matchId);
      e.dataTransfer.effectAllowed = "move";
      setDraggingId(matchId);
    },
    onDragEnd: () => setDraggingId(null),
  });

  if (days.length === 0 && unscheduled.length === 0) {
    return <p className="text-sm text-muted">No matches to schedule yet.</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <FormError message={error} />

      {days.map((day) => (
        <section key={day.day} className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">{day.heading}</h2>
          <div className="overflow-x-auto">
            <div className="grid w-max" style={{ gridTemplateColumns: `100px repeat(${day.courts.length}, 190px)` }}>
              <div className="sticky left-0 z-10 border-b border-border bg-surface" />
              {day.courts.map((court) => (
                <div key={`h-${court}`} className="border-b border-border px-2 py-1 text-sm font-semibold text-text">
                  {court}
                </div>
              ))}
              {day.rows.flatMap((row, rowIndex) => [
                <div
                  key={`t-${row.value}`}
                  className="sticky left-0 z-10 border-b border-border bg-surface px-2 py-1 text-xs text-muted"
                >
                  {row.label}
                </div>,
                ...day.courts.map((court) => {
                  const key = `${rowIndex}:${court}`;
                  const ids = day.cells[key] ?? [];
                  return (
                    <div
                      key={`c-${row.value}-${court}`}
                      data-testid="grid-cell"
                      data-day={day.day}
                      data-court={court}
                      data-row={row.value}
                      className="min-h-[3rem] border-b border-border p-1"
                      {...dropHandlers((draggedId) =>
                        move(draggedId, { scheduledAt: row.value, court: court === NO_COURT ? null : court }),
                      )}
                    >
                      {ids.length === 0 ? (
                        <div className="h-full min-h-[2.5rem] rounded-md border border-dashed border-border" />
                      ) : (
                        <div className="flex flex-col gap-1">
                          {ids.flatMap((id) => {
                            const match = matchesById.get(id);
                            if (!match) return [];
                            return [
                              <div
                                key={id}
                                data-match-id={id}
                                {...dragHandlers(id)}
                                className={`rounded-md border border-border bg-surface px-2 py-1 ${
                                  draggingId === id ? "opacity-50" : ""
                                } cursor-grab active:cursor-grabbing`}
                              >
                                <MatchGridCard
                                  match={match}
                                  courtCount={courtCount}
                                  firstDay={firstDay}
                                  lastDay={lastDay}
                                  refereeChoices={refereeChoices}
                                />
                              </div>,
                            ];
                          })}
                        </div>
                      )}
                    </div>
                  );
                }),
              ])}
            </div>
          </div>
        </section>
      ))}

      {unscheduled.length > 0 && (
        <section
          className="flex flex-col gap-3 border-t border-border pt-6"
          data-testid="unscheduled-dropzone"
          {...dropHandlers((draggedId) => move(draggedId, { scheduledAt: null, court: null }))}
        >
          <h2 className="text-lg font-semibold">Unscheduled ({unscheduled.length})</h2>
          <ul className="flex flex-col gap-1.5">
            {unscheduled.flatMap((id) => {
              const match = matchesById.get(id);
              if (!match) return [];
              return [
                <li
                  key={id}
                  data-match-id={id}
                  {...dragHandlers(id)}
                  className={`rounded-md border border-border px-2 py-1 ${
                    draggingId === id ? "opacity-50" : ""
                  } cursor-grab active:cursor-grabbing`}
                >
                  <MatchGridCard match={match} courtCount={courtCount} firstDay={firstDay} lastDay={lastDay} refereeChoices={refereeChoices} />
                </li>,
              ];
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

/**
 * Collapsed to just the basics (matchup, event/round) so a packed grid stays
 * readable — the "!" button reveals the Time/Court and referee forms
 * underneath, for the occasional precise edit (typing an exact time rather
 * than dragging, or assigning a referee).
 */
function MatchGridCard({
  match,
  courtCount,
  firstDay,
  lastDay,
  refereeChoices,
}: {
  match: GridMatch;
  courtCount: number;
  firstDay: string;
  lastDay: string;
  refereeChoices: { id: string; name: string }[];
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);

  return (
    <div className="flex flex-col gap-0.5 text-xs">
      <div className="flex items-center gap-1.5">
        <span className="min-w-0 flex-1 truncate font-medium text-text" title={match.label}>
          {match.label}
        </span>
        <Button
          type="button"
          variant="secondary"
          onClick={() => setDetailsOpen((open) => !open)}
          aria-expanded={detailsOpen}
          aria-label={detailsOpen ? "Hide match details" : "Show match details"}
          title={detailsOpen ? "Hide match details" : "Show match details"}
          className="h-5 w-5 shrink-0 rounded-full p-0 text-[11px] leading-none"
        >
          !
        </Button>
      </div>
      <div className="truncate text-[11px] text-muted" title={`${match.eventName} · ${match.stage}`}>
        {match.eventName} · {match.stage}
        {match.draftDraw && " · Draft draw"}
      </div>
      {detailsOpen && (
        <div className="mt-1 flex flex-col gap-2 border-t border-border pt-2 text-sm">
          <MatchScheduleForm
            matchId={match.matchId}
            initialScheduledAt={match.initialScheduledAt}
            initialCourt={match.initialCourt}
            courtCount={courtCount}
            firstDay={firstDay}
            lastDay={lastDay}
          />
          <MatchRefereeForm matchId={match.matchId} currentRefereeId={match.refereeId} referees={refereeChoices} />
        </div>
      )}
    </div>
  );
}
