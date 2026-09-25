"use client";

import { useActionState } from "react";
import { approveEntry, rejectEntry, type EntryActionState } from "@/app/actions/entries";
import { SubmitButton } from "@/components/SubmitButton";
import { FormError } from "@/components/FormError";

const initialState: EntryActionState = {};

export function PendingEntryActions({ entryId }: { entryId: string }) {
  const [approveState, approveAction] = useActionState(approveEntry.bind(null, entryId), initialState);
  const [rejectState, rejectAction] = useActionState(rejectEntry.bind(null, entryId), initialState);

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <form action={approveAction}>
          <SubmitButton variant="primary" pendingLabel="Approving…">
            Approve
          </SubmitButton>
        </form>
        <form
          action={rejectAction}
          onSubmit={(event) => {
            if (!confirm("Reject this registration? The player will be told it wasn't approved.")) {
              event.preventDefault();
            }
          }}
        >
          <SubmitButton variant="danger" pendingLabel="Rejecting…">
            Reject
          </SubmitButton>
        </form>
      </div>
      <FormError message={approveState.error ?? rejectState.error} />
    </div>
  );
}
