"use client";

import { useActionState } from "react";
import { createTeam, type TeamActionState } from "@/app/actions/teams";
import { TextField } from "@/components/TextField";
import { SubmitButton } from "@/components/SubmitButton";
import { FormError } from "@/components/FormError";

const initialState: TeamActionState = {};

export function CreateTeamForm({ eventId }: { eventId: string }) {
  const action = createTeam.bind(null, eventId);
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <TextField label="Team name" name="name" type="text" required className="sm:w-64" />
      <SubmitButton pendingLabel="Adding…">Add team</SubmitButton>
      <FormError message={state.error} />
    </form>
  );
}
