"use client";

import { useActionState } from "react";
import { addTeamMember, type TeamActionState } from "@/app/actions/teams";
import { TextField } from "@/components/TextField";
import { SubmitButton } from "@/components/SubmitButton";
import { FormError } from "@/components/FormError";

const initialState: TeamActionState = {};

export function AddTeamMemberForm({ teamId }: { teamId: string }) {
  const action = addTeamMember.bind(null, teamId);
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <TextField label="Player name" name="name" type="text" required className="sm:w-48" />
      <TextField
        label="Email (optional, links an existing account)"
        name="email"
        type="email"
        className="sm:w-64"
      />
      <SubmitButton pendingLabel="Adding…">Add to roster</SubmitButton>
      <FormError message={state.error} />
    </form>
  );
}
