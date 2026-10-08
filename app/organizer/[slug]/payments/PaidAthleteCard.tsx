"use client";

import { useActionState, useState } from "react";
import { saveAthletePayment, type AthleteKey, type PaymentActionState } from "@/app/actions/payments";
import { TextField } from "@/components/TextField";
import { SelectField } from "@/components/SelectField";
import { SubmitButton } from "@/components/SubmitButton";
import { Button } from "@/components/Button";
import { FormError } from "@/components/FormError";
import { useRemountKey } from "@/lib/useRemountKey";
import { METHOD_OPTIONS } from "@/app/organizer/[slug]/payments/UnpaidAthleteCard";

const initialState: PaymentActionState = {};

const METHOD_LABELS: Record<string, string> = { CASH: "Cash", ZELLE: "Zelle", OTHER: "Other" };

/**
 * One paid athlete: a compact summary by default (amount paid, method,
 * events, when, note), with "Edit" opening the full form — including
 * "Mark as unpaid" to undo, since there's no other way back to the unpaid
 * column once an athlete lands here.
 */
export function PaidAthleteCard({
  tournamentId,
  athlete,
  name,
  eventSummary,
  amount,
  method,
  note,
  paidAtLabel,
  initialPaidAt,
}: {
  tournamentId: string;
  athlete: AthleteKey;
  name: string;
  eventSummary: string;
  /** "" or a plain decimal string, e.g. "40" or "40.00". */
  amount: string;
  method: string;
  note: string;
  /** Pre-formatted for display, e.g. "Oct 8, 2026 · 9:15 AM". */
  paidAtLabel: string;
  /** "YYYY-MM-DDTHH:mm" for the edit form's datetime-local input. */
  initialPaidAt: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [state, formAction] = useActionState(saveAthletePayment.bind(null, tournamentId, athlete), initialState);
  const methodKey = useRemountKey(state);
  const [amountValue, setAmountValue] = useState(amount);
  const [methodValue, setMethodValue] = useState(method);
  const [noteValue, setNoteValue] = useState(note);
  const [paidAtValue, setPaidAtValue] = useState(initialPaidAt);

  if (!isOpen) {
    return (
      <li className="flex flex-col gap-2 rounded-md border border-border px-4 py-3">
        <div>
          <span className="font-medium text-text">{name}</span>
          <p className="text-sm text-muted">{eventSummary}</p>
        </div>
        <p className="text-sm text-text">
          {amount ? `$${amount}` : "No amount recorded"}
          {method && ` · ${METHOD_LABELS[method]}`}
          {paidAtLabel && ` · Paid ${paidAtLabel}`}
        </p>
        {note && <p className="text-sm text-muted">{note}</p>}
        <div>
          <Button type="button" variant="secondary" className="px-2 py-1 text-xs" onClick={() => setIsOpen(true)}>
            Edit
          </Button>
        </div>
      </li>
    );
  }

  return (
    <li className="flex flex-col gap-2 rounded-md border border-border px-4 py-3">
      <div>
        <span className="font-medium text-text">{name}</span>
        <p className="text-sm text-muted">{eventSummary}</p>
      </div>
      <form action={formAction} className="flex flex-col gap-2">
        <div className="flex flex-wrap items-end gap-2">
          <TextField
            label="Amount paid"
            name="amount"
            type="number"
            min={0}
            step="0.01"
            value={amountValue}
            onChange={(e) => setAmountValue(e.target.value)}
            className="w-24"
          />
          <SelectField
            key={methodKey}
            label="Method"
            name="method"
            value={methodValue}
            onChange={(e) => setMethodValue(e.target.value)}
            className="w-28"
          >
            {METHOD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectField>
          <TextField
            label="Paid at"
            name="paidAt"
            type="datetime-local"
            value={paidAtValue}
            onChange={(e) => setPaidAtValue(e.target.value)}
          />
        </div>
        <TextField label="Note" name="note" type="text" value={noteValue} onChange={(e) => setNoteValue(e.target.value)} />
        <div className="flex flex-wrap items-center gap-2">
          <SubmitButton name="intent" value="save" variant="secondary" pendingLabel="Saving…">
            Save
          </SubmitButton>
          <SubmitButton
            name="intent"
            value="unpay"
            variant="danger"
            pendingLabel="Saving…"
            onClick={(e) => {
              if (!confirm(`Mark ${name} as unpaid? This moves them back to the unpaid column.`)) e.preventDefault();
            }}
          >
            Mark as unpaid
          </SubmitButton>
          <Button type="button" variant="secondary" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
        </div>
        <FormError message={state.error} />
      </form>
    </li>
  );
}
