"use client";

import { useActionState } from "react";
import { removeEntryAsOrganizer, type EntryActionState } from "@/app/actions/entries";
import { SubmitButton } from "@/components/SubmitButton";
import { FormError } from "@/components/FormError";

const initialState: EntryActionState = {};

export function RemoveEntryButton({ entryId }: { entryId: string }) {
  const action = removeEntryAsOrganizer.bind(null, entryId);
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!confirm("Remove this entry?")) {
          event.preventDefault();
        }
      }}
      className="flex flex-col items-end gap-1"
    >
      <SubmitButton variant="danger" pendingLabel="Removing…">
        Remove
      </SubmitButton>
      <FormError message={state.error} />
    </form>
  );
}
