"use client";

import { useActionState, useState } from "react";
import { setMatchSchedule, type ScheduleActionState } from "@/app/actions/schedule";
import { CourtSelect } from "@/components/CourtSelect";
import { TextField } from "@/components/TextField";
import { SubmitButton } from "@/components/SubmitButton";
import { FormError } from "@/components/FormError";
import { useRemountKey } from "@/lib/useRemountKey";

const initialState: ScheduleActionState = {};

export function MatchScheduleForm({
  matchId,
  initialScheduledAt,
  initialCourt,
  courtCount,
  firstDay,
  lastDay,
}: {
  matchId: string;
  /** "YYYY-MM-DDTHH:mm" for the datetime input, or "" when unscheduled. */
  initialScheduledAt: string;
  initialCourt: string;
  courtCount: number;
  /** Tournament days ("YYYY-MM-DD") bounding the picker. */
  firstDay: string;
  lastDay: string;
}) {
  const [state, formAction] = useActionState(setMatchSchedule.bind(null, matchId), initialState);
  // A native form reset after each save snaps the court dropdown back without
  // telling React; remounting it keeps what's shown in step with state.
  const courtKey = useRemountKey(state);
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
        <CourtSelect
          key={courtKey}
          label="Court"
          id={`court-${matchId}`}
          name="court"
          courtCount={courtCount}
          valueAs="name"
          emptyLabel="No court"
          legacyValue={initialCourt}
          className="w-36"
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
