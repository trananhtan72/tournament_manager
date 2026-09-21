"use client";

import { useActionState } from "react";
import { quickAddEntry, type EntryActionState } from "@/app/actions/entries";
import { TextField } from "@/components/TextField";
import { SubmitButton } from "@/components/SubmitButton";
import { FormError } from "@/components/FormError";

const initialState: EntryActionState = {};

export function QuickAddEntryForm({
  eventId,
  isDoubles,
}: {
  eventId: string;
  isDoubles: boolean;
}) {
  const action = quickAddEntry.bind(null, eventId);
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField label={isDoubles ? "Player 1 name" : "Player name"} name="player1Name" type="text" required />
        <TextField
          label="Email (optional, links an existing account)"
          name="player1Email"
          type="email"
        />
      </div>
      {isDoubles && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            label="Player 2 name (leave blank if pairing later)"
            name="player2Name"
            type="text"
          />
          <TextField
            label="Email (optional, links an existing account)"
            name="player2Email"
            type="email"
          />
        </div>
      )}
      <FormError message={state.error} />
      <div>
        <SubmitButton pendingLabel="Adding…">Add entry</SubmitButton>
      </div>
    </form>
  );
}
