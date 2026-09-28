"use client";

import { useActionState } from "react";
import { moveEntryToByeSlot, type DrawActionState } from "@/app/actions/draws";
import { SelectField } from "@/components/SelectField";
import { SubmitButton } from "@/components/SubmitButton";
import { FormError } from "@/components/FormError";

const initialState: DrawActionState = {};

export function MoveEntryToByeForm({
  eventId,
  candidates,
  byeSlots,
  isPublished,
}: {
  eventId: string;
  candidates: { entryId: string; label: string }[];
  byeSlots: { matchId: string; label: string }[];
  isPublished: boolean;
}) {
  const action = moveEntryToByeSlot.bind(null, eventId);
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        const message = isPublished
          ? "Move this entry into the empty slot? Its current opponent gets the bye instead, and players and the public will see the change immediately."
          : "Move this entry into the empty slot? Its current opponent gets the bye instead.";
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
        <SelectField label="Move to" name="targetMatchId" required defaultValue="">
          <option value="" disabled>
            Select an empty slot
          </option>
          {byeSlots.map((s) => (
            <option key={s.matchId} value={s.matchId}>
              {s.label}
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
