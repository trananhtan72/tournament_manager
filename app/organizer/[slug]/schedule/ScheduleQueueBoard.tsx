"use client";

import { useActionState, useMemo, useState } from "react";
import { recalculateQueueTimes, type RecalculateQueueActionState } from "@/app/actions/schedule";
import { MatchScheduleForm } from "@/app/organizer/[slug]/schedule/MatchScheduleForm";
import { MatchRefereeForm } from "@/app/organizer/[slug]/referees/MatchRefereeForm";
import { SubmitButton } from "@/components/SubmitButton";
import { FormError } from "@/components/FormError";

const initialState: RecalculateQueueActionState = {};

export type QueueMatch = {
  matchId: string;
  eventName: string;
  stage: string;
  label: string;
  /** "9:00 AM", or null for an unscheduled match. */
  timeLabel: string | null;
  /** "YYYY-MM-DDTHH:mm" for the time-edit form, or "" when unscheduled. */
  initialScheduledAt: string;
  initialCourt: string;
  refereeId: string | null;
  /** The event's draw isn't published yet — players can't see this match. */
  draftDraw: boolean;
};

export type CourtQueue = { court: string; matches: QueueMatch[] };
export type DaySection = { day: string; heading: string; courts: CourtQueue[] };

function queueKey(day: string, court: string): string {
  return `${day}::${court}`;
}

function buildOrders(days: DaySection[]): Record<string, string[]> {
  const orders: Record<string, string[]> = {};
  for (const day of days) {
    for (const col of day.courts) {
      orders[queueKey(day.day, col.court)] = col.matches.map((m) => m.matchId);
    }
  }
  return orders;
}

/**
 * Each court's matches for one day, in a draggable queue: drop a card
 * somewhere else in its own court to reorder it, then "Update time" recomputes
 * that court's times from the new order (see resequenceQueueTimes). Dragging
 * is confined to one court's queue — moving a match to a different court or
 * day is still done through its own Time/Court fields on the card.
 */
export function ScheduleQueueBoard({
  tournamentId,
  days,
  unscheduled,
  courtCount,
  firstDay,
  lastDay,
  refereeChoices,
}: {
  tournamentId: string;
  days: DaySection[];
  unscheduled: QueueMatch[];
  courtCount: number;
  firstDay: string;
  lastDay: string;
  refereeChoices: { id: string; name: string }[];
}) {
  const matchesById = useMemo(() => {
    const map = new Map<string, QueueMatch>();
    for (const day of days) for (const col of day.courts) for (const m of col.matches) map.set(m.matchId, m);
    return map;
  }, [days]);

  const initialOrders = useMemo(() => buildOrders(days), [days]);
  // A signature of every queued match's id/time/court — changes whenever the
  // server data actually moves (a save elsewhere, or a successful "Update
  // time"), so dragging state can be kept in sync without re-deriving it on
  // every render. Any reordering not yet submitted is discarded along with
  // it; "Update time" always submits every reordered queue at once, so by
  // the time this fires after a successful update, nothing should be lost.
  const signature = useMemo(
    () =>
      days
        .flatMap((d) => d.courts.flatMap((c) => c.matches.map((m) => `${m.matchId}:${m.initialScheduledAt}:${c.court}`)))
        .join("|"),
    [days],
  );
  const [orders, setOrders] = useState<Record<string, string[]>>(initialOrders);
  // Adjusting state during render (React's documented pattern for "reset
  // state when a prop changes") instead of an effect — avoids an extra
  // commit-then-re-render pass for what's otherwise a plain derived reset.
  const [syncedSignature, setSyncedSignature] = useState(signature);
  if (signature !== syncedSignature) {
    setSyncedSignature(signature);
    setOrders(initialOrders);
  }

  const [draggingId, setDraggingId] = useState<string | null>(null);

  const reorder = (key: string, draggedId: string, targetId: string) => {
    if (draggedId === targetId) return;
    setOrders((prev) => {
      const list = prev[key];
      if (!list || !list.includes(draggedId) || !list.includes(targetId)) return prev;
      const without = list.filter((id) => id !== draggedId);
      const targetIndex = without.indexOf(targetId);
      without.splice(targetIndex, 0, draggedId);
      return { ...prev, [key]: without };
    });
  };

  const dirtyKeys = Object.keys(orders).filter((key) => orders[key].join(",") !== (initialOrders[key] ?? []).join(","));

  const [state, formAction] = useActionState(recalculateQueueTimes.bind(null, tournamentId), initialState);

  if (days.length === 0 && unscheduled.length === 0) {
    return <p className="text-sm text-muted">No matches to schedule yet.</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <form
        action={(formData) => {
          const queues = dirtyKeys.map((key) => ({ matchIds: orders[key] }));
          formData.set("queues", JSON.stringify(queues));
          formAction(formData);
        }}
        className="flex flex-wrap items-center gap-3"
      >
        <SubmitButton variant="secondary" pendingLabel="Updating…">
          Update time
        </SubmitButton>
        <span className="text-sm text-muted">
          Drag a card within its court&apos;s queue to reorder it, then click this to recalculate times.
        </span>
        {state.updatedCount !== undefined && (
          <span className="text-sm text-success">
            Updated the time for {state.updatedCount} {state.updatedCount === 1 ? "match" : "matches"}.
          </span>
        )}
      </form>
      <FormError message={state.error} />

      {days.map((day) => (
        <section key={day.day} className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">{day.heading}</h2>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4">
            {day.courts.map((col) => {
              const key = queueKey(day.day, col.court);
              const order = orders[key] ?? [];
              const draggable = order.length > 1;
              return (
                <div key={key} className="flex min-w-0 flex-col gap-2 rounded-md border border-border p-3">
                  <h3 className="text-sm font-semibold text-text">{col.court}</h3>
                  <ul className="flex flex-col gap-3" data-testid="queue-column" data-court={col.court} data-day={day.day}>
                    {order.map((id) => {
                      const match = matchesById.get(id);
                      if (!match) return null;
                      return (
                        <li
                          key={id}
                          data-match-id={id}
                          draggable={draggable}
                          onDragStart={(e) => {
                            // The dragged id travels on the native dataTransfer payload, read back
                            // synchronously in onDrop — not from React state, which isn't guaranteed
                            // to have committed a re-render between dragstart and drop.
                            e.dataTransfer.setData("text/plain", id);
                            e.dataTransfer.effectAllowed = "move";
                            setDraggingId(id);
                          }}
                          onDragEnd={() => setDraggingId(null)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            const draggedId = e.dataTransfer.getData("text/plain");
                            if (draggedId) reorder(key, draggedId, id);
                          }}
                          className={`rounded-md border border-border bg-surface px-3 py-2 ${
                            draggingId === id ? "opacity-50" : ""
                          } ${draggable ? "cursor-grab active:cursor-grabbing" : ""}`}
                        >
                          <MatchQueueCard
                            match={match}
                            courtCount={courtCount}
                            firstDay={firstDay}
                            lastDay={lastDay}
                            refereeChoices={refereeChoices}
                          />
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {unscheduled.length > 0 && (
        <section className="flex flex-col gap-3 border-t border-border pt-6">
          <h2 className="text-lg font-semibold">Unscheduled ({unscheduled.length})</h2>
          <ul className="flex flex-col gap-2">
            {unscheduled.map((match) => (
              <li key={match.matchId} className="rounded-md border border-border px-4 py-3">
                <MatchQueueCard
                  match={match}
                  courtCount={courtCount}
                  firstDay={firstDay}
                  lastDay={lastDay}
                  refereeChoices={refereeChoices}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function MatchQueueCard({
  match,
  courtCount,
  firstDay,
  lastDay,
  refereeChoices,
}: {
  match: QueueMatch;
  courtCount: number;
  firstDay: string;
  lastDay: string;
  refereeChoices: { id: string; name: string }[];
}) {
  return (
    <div className="flex flex-col gap-2 text-sm">
      {match.timeLabel && <div className="font-semibold text-text">{match.timeLabel}</div>}
      <div className="text-xs text-muted">
        {match.eventName} · {match.stage}
        {match.draftDraw && " · Draft draw"}
      </div>
      <div className="font-medium">{match.label}</div>
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
  );
}
