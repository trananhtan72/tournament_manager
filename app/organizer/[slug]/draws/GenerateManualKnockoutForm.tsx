"use client";

import { useActionState } from "react";
import { generateManualKnockoutStage, type DrawActionState } from "@/app/actions/draws";
import { SelectField } from "@/components/SelectField";
import { SubmitButton } from "@/components/SubmitButton";
import { FormError } from "@/components/FormError";

const initialState: DrawActionState = {};

export function GenerateManualKnockoutForm({ eventId }: { eventId: string }) {
  const action = generateManualKnockoutStage.bind(null, eventId);
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!confirm("Set up a blank knockout bracket for a manual draw? You'll place entries into it yourself.")) {
          event.preventDefault();
        }
      }}
      className="flex flex-col gap-3 sm:flex-row sm:items-end"
    >
      <SelectField label="Bracket size (advances per pool)" name="advancesPerPool" defaultValue="1">
        <option value="1">Top 1</option>
        <option value="2">Top 2</option>
      </SelectField>
      <div className="flex flex-col gap-1">
        <SubmitButton variant="secondary" pendingLabel="Setting up…">
          Set up knockout stage manually
        </SubmitButton>
        <FormError message={state.error} />
      </div>
    </form>
  );
}
