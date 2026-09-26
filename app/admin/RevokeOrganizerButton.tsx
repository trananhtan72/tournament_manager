"use client";

import { useActionState } from "react";
import { revokeOrganizerAccess, type AdminActionState } from "@/app/actions/admin";
import { FormError } from "@/components/FormError";
import { SubmitButton } from "@/components/SubmitButton";

const initialState: AdminActionState = {};

export function RevokeOrganizerButton({ userId, name }: { userId: string; name: string }) {
  const [state, formAction] = useActionState(revokeOrganizerAccess.bind(null, userId), initialState);

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!confirm(`Revoke ${name}'s ability to create new tournaments? Tournaments they've already created are unaffected.`)) {
          event.preventDefault();
        }
      }}
      className="flex flex-col items-end gap-1"
    >
      <SubmitButton variant="danger" pendingLabel="Revoking…">
        Revoke
      </SubmitButton>
      <FormError message={state.error} />
    </form>
  );
}
