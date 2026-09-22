"use client";

import { useActionState } from "react";
import { swapBracketEntries, type DrawActionState } from "@/app/actions/draws";
import { SelectField } from "@/components/SelectField";
import { SubmitButton } from "@/components/SubmitButton";
import { FormError } from "@/components/FormError";

const initialState: DrawActionState = {};

export function SwapEntriesForm({
  eventId,
  candidates,
  isPublished,
}: {
  eventId: string;
  candidates: { entryId: string; label: string }[];
  isPublished: boolean;
}) {
  const action = swapBracketEntries.bind(null, eventId);
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        const message = isPublished
          ? "Swap these two entries? The draw is already published, so players and the public will see the change immediately."
          : "Swap these two entries in the draw?";
        if (!confirm(message)) {
          event.preventDefault();
        }
      }}
      className="flex flex-col gap-3"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <SelectField label="Entry A" name="entryIdA" required defaultValue="">
          <option value="" disabled>
            Select an entry
          </option>
          {candidates.map((c) => (
            <option key={c.entryId} value={c.entryId}>
              {c.label}
            </option>
          ))}
        </SelectField>
        <SelectField label="Entry B" name="entryIdB" required defaultValue="">
          <option value="" disabled>
            Select an entry
          </option>
          {candidates.map((c) => (
            <option key={c.entryId} value={c.entryId}>
              {c.label}
            </option>
          ))}
        </SelectField>
        <SubmitButton variant="secondary" pendingLabel="Swapping…">
          Swap entries
        </SubmitButton>
      </div>
      <FormError message={state.error} />
    </form>
  );
}
