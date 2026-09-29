"use client";

import { useActionState, useRef } from "react";
import { bulkScheduleMatches, type BulkScheduleActionState } from "@/app/actions/schedule";
import { TextField } from "@/components/TextField";
import { SubmitButton } from "@/components/SubmitButton";
import { FormError } from "@/components/FormError";

const initialState: BulkScheduleActionState = {};

export type BulkScheduleEventGroup = {
  eventId: string;
  eventName: string;
  matches: { id: string; stage: string; label: string; currentTime: string | null }[];
};

/**
 * Assigns (or reassigns) the checked matches a time and a court for one day,
 * distributed evenly across the tournament's courts and respecting each
 * player's minimum rest — for planning or revising a whole day at once
 * instead of setting each match's time and court individually below.
 */
export function BulkScheduleForm({
  tournamentId,
  events,
  firstDay,
  lastDay,
}: {
  tournamentId: string;
  events: BulkScheduleEventGroup[];
  firstDay: string;
  lastDay: string;
}) {
  const [state, formAction] = useActionState(bulkScheduleMatches.bind(null, tournamentId), initialState);
  const formRef = useRef<HTMLFormElement>(null);

  const toggleEvent = (eventId: string, checked: boolean) => {
    formRef.current
      ?.querySelectorAll<HTMLInputElement>(`input[data-event-id="${eventId}"]`)
      .forEach((checkbox) => {
        checkbox.checked = checked;
      });
  };

  if (events.length === 0) {
    return <p className="text-sm text-muted">No matches are ready to schedule yet.</p>;
  }

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3">
        <TextField label="Date" name="date" type="date" min={firstDay} max={lastDay} required />
        <TextField label="Start time" name="startTime" type="time" defaultValue="09:00" required />
        <TextField
          label="Minutes per match"
          name="durationMinutes"
          type="number"
          min={5}
          defaultValue={40}
          required
          className="w-28"
        />
        <TextField
          label="Min. rest before a player's next match"
          name="minRestMinutes"
          type="number"
          min={0}
          defaultValue={10}
          required
          className="w-28"
        />
      </div>

      <div className="flex flex-col gap-3">
        {events.map((event) => (
          <div key={event.eventId} className="rounded-md border border-border p-3">
            <label className="flex items-center gap-2 text-sm font-semibold text-text">
              <input
                type="checkbox"
                onChange={(e) => toggleEvent(event.eventId, e.target.checked)}
                aria-label={`Select all of ${event.eventName}`}
              />
              {event.eventName}
            </label>
            <ul className="mt-2 flex flex-col gap-1.5 pl-6">
              {event.matches.map((match) => (
                <li key={match.id}>
                  <label className="flex flex-wrap items-center gap-2 text-sm text-text">
                    <input type="checkbox" name="matchIds" value={match.id} data-event-id={event.eventId} />
                    <span className="text-muted">{match.stage} ·</span> {match.label}
                    {match.currentTime ? (
                      <span className="text-xs text-muted">(currently {match.currentTime})</span>
                    ) : (
                      <span className="text-xs text-muted">(not yet scheduled)</span>
                    )}
                  </label>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton name="intent" value="schedule" pendingLabel="Scheduling…">
          Schedule checked matches
        </SubmitButton>
        <SubmitButton name="intent" value="reset" variant="secondary" formNoValidate pendingLabel="Unscheduling…">
          Unschedule checked matches
        </SubmitButton>
        {state.scheduledCount !== undefined && (
          <span className="text-sm text-success">
            Set the time for {state.scheduledCount} {state.scheduledCount === 1 ? "match" : "matches"}.
          </span>
        )}
        {state.resetCount !== undefined && (
          <span className="text-sm text-success">
            Cleared the time for {state.resetCount} {state.resetCount === 1 ? "match" : "matches"}.
          </span>
        )}
      </div>
      <FormError message={state.error} />
    </form>
  );
}
