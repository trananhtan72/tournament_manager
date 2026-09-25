"use client";

import { useActionState } from "react";
import { removeReferee, type RefereeActionState } from "@/app/actions/referees";
import { FormError } from "@/components/FormError";
import { SubmitButton } from "@/components/SubmitButton";

const initialState: RefereeActionState = {};

export function RemoveRefereeButton({ refereeId, name, assigned }: { refereeId: string; name: string; assigned: number }) {
  const [state, formAction] = useActionState(removeReferee.bind(null, refereeId), initialState);

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        const extra = assigned > 0 ? ` Their ${assigned} assigned ${assigned === 1 ? "match" : "matches"} will be unassigned.` : "";
        if (!confirm(`Remove ${name} as a referee?${extra}`)) event.preventDefault();
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
