"use client";

import { useActionState, useState } from "react";
import { setMatchDurationMinutes, type MatchDurationActionState } from "@/app/actions/schedule";
import { TextField } from "@/components/TextField";
import { SubmitButton } from "@/components/SubmitButton";
import { FormError } from "@/components/FormError";

const initialState: MatchDurationActionState = {};

/**
 * One duration for every match in the tournament — used by the bulk
 * schedule tool below, the post-match cascade reschedule, and the
 * dashboard's "next match" estimate, so they can't end up using different
 * assumed lengths (e.g. a morning session scheduled at one duration, an
 * afternoon one at another).
 */
export function MatchDurationForm({ tournamentId, initialMinutes }: { tournamentId: string; initialMinutes: number }) {
  const [state, formAction] = useActionState(setMatchDurationMinutes.bind(null, tournamentId), initialState);
  const [minutes, setMinutes] = useState(String(initialMinutes));
  const [submitted, setSubmitted] = useState<string | null>(null);

  const showSaved = state.saved && submitted === minutes;

  return (
    <div className="flex flex-col gap-1">
      <form
        action={(formData) => {
          setSubmitted(String(formData.get("matchDurationMinutes")));
          formAction(formData);
        }}
        className="flex flex-wrap items-end gap-2"
      >
        <TextField
          label="Minutes per match (applies to every match in this tournament)"
          name="matchDurationMinutes"
          type="number"
          min={5}
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
          className="w-28"
        />
        <SubmitButton variant="secondary" pendingLabel="Saving…">
          Save
        </SubmitButton>
        {showSaved && <span className="pb-2 text-sm text-success">Saved</span>}
      </form>
      <FormError message={state.error} />
    </div>
  );
}
