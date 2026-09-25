"use client";

import { useActionState, useState } from "react";
import { setMatchSchedule, type ScheduleActionState } from "@/app/actions/schedule";
import { TextField } from "@/components/TextField";
import { SubmitButton } from "@/components/SubmitButton";
import { FormError } from "@/components/FormError";

const initialState: ScheduleActionState = {};

export const COURT_SUGGESTIONS_ID = "court-suggestions";

export function MatchScheduleForm({
  matchId,
  initialScheduledAt,
  initialCourt,
  firstDay,
  lastDay,
}: {
  matchId: string;
  /** "YYYY-MM-DDTHH:mm" for the datetime input, or "" when unscheduled. */
  initialScheduledAt: string;
  initialCourt: string;
  /** Tournament days ("YYYY-MM-DD") bounding the picker. */
  firstDay: string;
  lastDay: string;
}) {
  const [state, formAction] = useActionState(setMatchSchedule.bind(null, matchId), initialState);
  // Controlled so a rejected save doesn't wipe what was typed (React resets
  // uncontrolled fields after every action).
  const [scheduledAt, setScheduledAt] = useState(initialScheduledAt);
  const [court, setCourt] = useState(initialCourt);
  const [submitted, setSubmitted] = useState<string | null>(null);

  const showSaved = state.saved && submitted === `${scheduledAt}|${court}`;

  return (
    <div className="flex flex-col gap-1">
      <form
        action={(formData) => {
          setSubmitted(`${formData.get("scheduledAt")}|${formData.get("court")}`);
          formAction(formData);
        }}
        className="flex flex-wrap items-end gap-2"
      >
        <TextField
          label="Time"
          id={`scheduledAt-${matchId}`}
          name="scheduledAt"
          type="datetime-local"
          min={`${firstDay}T00:00`}
          max={`${lastDay}T23:59`}
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
        />
        <TextField
          label="Court"
          id={`court-${matchId}`}
          name="court"
          type="text"
          list={COURT_SUGGESTIONS_ID}
          maxLength={40}
          placeholder="Optional"
          className="w-32"
          value={court}
          onChange={(e) => setCourt(e.target.value)}
        />
        <SubmitButton variant="secondary" pendingLabel="Saving…">
          Save
        </SubmitButton>
        {showSaved && <span className="pb-2 text-sm text-emerald-600 dark:text-emerald-400">Saved</span>}
      </form>
      <FormError message={state.error} />
    </div>
  );
}
