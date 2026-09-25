"use client";

import { useActionState } from "react";
import { pairEntries, type EntryActionState } from "@/app/actions/entries";
import { SelectField } from "@/components/SelectField";
import { SubmitButton } from "@/components/SubmitButton";
import { FormError } from "@/components/FormError";

const initialState: EntryActionState = {};

export function PairEntriesForm({
  eventId,
  candidates,
}: {
  eventId: string;
  candidates: { entryId: string; playerName: string }[];
}) {
  const action = pairEntries.bind(null, eventId);
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <SelectField label="Player A" name="entryIdA" required defaultValue="">
          <option value="" disabled>
            Select a player
          </option>
          {candidates.map((c) => (
            <option key={c.entryId} value={c.entryId}>
              {c.playerName}
            </option>
          ))}
        </SelectField>
        <SelectField label="Player B" name="entryIdB" required defaultValue="">
          <option value="" disabled>
            Select a player
          </option>
          {candidates.map((c) => (
            <option key={c.entryId} value={c.entryId}>
              {c.playerName}
            </option>
          ))}
        </SelectField>
        <SubmitButton pendingLabel="Pairing…">Pair as partners</SubmitButton>
      </div>
      <FormError message={state.error} />
    </form>
  );
}
