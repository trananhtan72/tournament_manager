"use client";

import { useActionState, useState } from "react";
import { assignReferee, type RefereeActionState } from "@/app/actions/referees";
import { FormError } from "@/components/FormError";
import { SelectField } from "@/components/SelectField";
import { SubmitButton } from "@/components/SubmitButton";
import { TextField } from "@/components/TextField";
import { useRemountKey } from "@/lib/useRemountKey";

const initialState: RefereeActionState = {};
const EMAIL_CHOICE = "__email__";

/** Pick a match's referee from the tournament's list, or enter someone's email. */
export function MatchRefereeForm({
  matchId,
  currentRefereeId,
  referees,
}: {
  matchId: string;
  currentRefereeId: string | null;
  referees: { id: string; name: string }[];
}) {
  const [state, formAction] = useActionState(assignReferee.bind(null, matchId), initialState);
  const [choice, setChoice] = useState(currentRefereeId ?? "");
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState<string | null>(null);
  // A native form reset after each save snaps the dropdown back without telling
  // React; remounting it keeps what's shown in step with state.
  const selectKey = useRemountKey(state);

  const showSaved = state.saved && submitted === `${choice}|${email}`;

  return (
    <div className="flex flex-col gap-1">
      <form
        action={(formData) => {
          setSubmitted(`${formData.get("referee")}|${formData.get("email") ?? ""}`);
          formAction(formData);
        }}
        className="flex flex-wrap items-end gap-2"
      >
        <SelectField
          key={selectKey}
          label="Referee"
          id={`referee-${matchId}`}
          name="referee"
          value={choice}
          onChange={(e) => setChoice(e.target.value)}
          className="w-52"
        >
          <option value="">No referee</option>
          {referees.map((referee) => (
            <option key={referee.id} value={referee.id}>
              {referee.name}
            </option>
          ))}
          <option value={EMAIL_CHOICE}>Someone else — enter email…</option>
        </SelectField>
        {choice === EMAIL_CHOICE && (
          <TextField
            label="Referee's email"
            id={`referee-email-${matchId}`}
            name="email"
            type="email"
            required
            className="w-56"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        )}
        <SubmitButton variant="secondary" pendingLabel="Saving…">
          Assign
        </SubmitButton>
        {showSaved && <span className="pb-2 text-sm text-success">Saved</span>}
      </form>
      <FormError message={state.error} />
    </div>
  );
}
