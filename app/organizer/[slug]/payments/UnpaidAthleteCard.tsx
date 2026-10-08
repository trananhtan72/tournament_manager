"use client";

import { useActionState, useState } from "react";
import { saveAthletePayment, type AthleteKey, type PaymentActionState } from "@/app/actions/payments";
import { TextField } from "@/components/TextField";
import { SelectField } from "@/components/SelectField";
import { SubmitButton } from "@/components/SubmitButton";
import { FormError } from "@/components/FormError";
import { dateTimeLocalFromDevice } from "@/lib/tournament/schedule";
import { useRemountKey } from "@/lib/useRemountKey";

const initialState: PaymentActionState = {};

export const METHOD_OPTIONS = [
  { value: "CASH", label: "Cash" },
  { value: "ZELLE", label: "Zelle" },
  { value: "OTHER", label: "Other" },
];

/** One not-yet-paid athlete: amount/method/note are editable here, with "Pay" saving them together and marking paid. */
export function UnpaidAthleteCard({
  tournamentId,
  athlete,
  name,
  eventSummary,
  initialAmount,
  initialMethod,
  initialNote,
}: {
  tournamentId: string;
  athlete: AthleteKey;
  name: string;
  eventSummary: string;
  initialAmount: string;
  initialMethod: string;
  initialNote: string;
}) {
  const [state, formAction] = useActionState(saveAthletePayment.bind(null, tournamentId, athlete), initialState);
  // A native form reset after each submit snaps the method dropdown back without
  // telling React; remounting it keeps what's shown in step with state.
  const methodKey = useRemountKey(state);
  // Controlled so a rejected submit doesn't wipe what was typed (React resets
  // uncontrolled fields after every action).
  const [amount, setAmount] = useState(initialAmount);
  const [method, setMethod] = useState(initialMethod);
  const [note, setNote] = useState(initialNote);

  return (
    <li className="flex flex-col gap-2 rounded-md border border-border px-4 py-3">
      <div>
        <span className="font-medium text-text">{name}</span>
        <p className="text-sm text-muted">{eventSummary}</p>
      </div>
      <form
        action={(formData) => {
          // The organizer's device clock at the moment they confirm, not when the card loaded.
          formData.set("paidAt", dateTimeLocalFromDevice());
          formAction(formData);
        }}
        className="flex flex-wrap items-end gap-2"
      >
        <TextField
          label="Amount due"
          name="amount"
          type="number"
          min={0}
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-24"
        />
        <SelectField
          key={methodKey}
          label="Method"
          name="method"
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          className="w-28"
        >
          {METHOD_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectField>
        <TextField label="Note" name="note" type="text" value={note} onChange={(e) => setNote(e.target.value)} className="w-40" />
        <SubmitButton
          name="intent"
          value="pay"
          pendingLabel="Saving…"
          onClick={(e) => {
            if (!confirm(`Mark ${name} as paid?`)) e.preventDefault();
          }}
        >
          Pay
        </SubmitButton>
      </form>
      <FormError message={state.error} />
    </li>
  );
}
