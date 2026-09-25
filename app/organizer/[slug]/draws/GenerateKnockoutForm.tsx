"use client";

import { useActionState } from "react";
import { generateKnockoutStage } from "@/app/actions/draws";
import type { DrawActionState } from "@/app/actions/draws";
import { SelectField } from "@/components/SelectField";
import { SubmitButton } from "@/components/SubmitButton";
import { FormError } from "@/components/FormError";

const initialState: DrawActionState = {};

export function GenerateKnockoutForm({ eventId }: { eventId: string }) {
  const action = generateKnockoutStage.bind(null, eventId);
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!confirm("Generate the knockout stage from the current pool standings?")) {
          event.preventDefault();
        }
      }}
      className="flex flex-col gap-3 sm:flex-row sm:items-end"
    >
      <SelectField label="Advance per pool" name="advancesPerPool" defaultValue="1">
        <option value="1">Top 1</option>
        <option value="2">Top 2</option>
      </SelectField>
      <div className="flex flex-col gap-1">
        <SubmitButton pendingLabel="Generating…">Generate knockout stage</SubmitButton>
        <FormError message={state.error} />
      </div>
    </form>
  );
}
