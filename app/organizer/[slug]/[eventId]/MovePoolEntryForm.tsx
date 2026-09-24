"use client";

import { useActionState } from "react";
import { movePoolEntry, type DrawActionState } from "@/app/actions/draws";
import { SelectField } from "@/components/SelectField";
import { SubmitButton } from "@/components/SubmitButton";
import { FormError } from "@/components/FormError";

const initialState: DrawActionState = {};

export function MovePoolEntryForm({
  eventId,
  candidates,
  pools,
  isPublished,
}: {
  eventId: string;
  candidates: { entryId: string; label: string }[];
  pools: { poolId: string; name: string }[];
  isPublished: boolean;
}) {
  const action = movePoolEntry.bind(null, eventId);
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        const message = isPublished
          ? "Move this entry to a different pool? Pool sizes will become unequal, and players and the public will see the change immediately."
          : "Move this entry to a different pool? Pool sizes will become unequal.";
        if (!confirm(message)) {
          event.preventDefault();
        }
      }}
      className="flex flex-col gap-3"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <SelectField label="Entry" name="entryId" required defaultValue="">
          <option value="" disabled>
            Select an entry
          </option>
          {candidates.map((c) => (
            <option key={c.entryId} value={c.entryId}>
              {c.label}
            </option>
          ))}
        </SelectField>
        <SelectField label="Move to" name="targetPoolId" required defaultValue="">
          <option value="" disabled>
            Select a pool
          </option>
          {pools.map((p) => (
            <option key={p.poolId} value={p.poolId}>
              {p.name}
            </option>
          ))}
        </SelectField>
        <SubmitButton variant="secondary" pendingLabel="Moving…">
          Move entry
        </SubmitButton>
      </div>
      <FormError message={state.error} />
    </form>
  );
}
