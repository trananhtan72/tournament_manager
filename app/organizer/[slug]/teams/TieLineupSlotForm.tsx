"use client";

import { useActionState } from "react";
import { submitTieLineupSlot, type TieActionState } from "@/app/actions/ties";
import { SelectField } from "@/components/SelectField";
import { SubmitButton } from "@/components/SubmitButton";
import { FormError } from "@/components/FormError";

const initialState: TieActionState = {};

export function TieLineupSlotForm({
  tieId,
  slotOrder,
  side,
  roster,
  neededPlayers,
}: {
  tieId: string;
  slotOrder: number;
  side: 1 | 2;
  roster: { id: string; label: string }[];
  neededPlayers: 1 | 2;
}) {
  const action = submitTieLineupSlot.bind(null, tieId, slotOrder, side);
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <SelectField label={neededPlayers === 2 ? "Player 1" : "Player"} name="memberId1" required defaultValue="">
        <option value="" disabled>
          Select a player
        </option>
        {roster.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
      </SelectField>
      {neededPlayers === 2 && (
        <SelectField label="Player 2" name="memberId2" required defaultValue="">
          <option value="" disabled>
            Select a player
          </option>
          {roster.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </SelectField>
      )}
      <FormError message={state.error} />
      <div>
        <SubmitButton pendingLabel="Saving…">Save lineup</SubmitButton>
      </div>
    </form>
  );
}
