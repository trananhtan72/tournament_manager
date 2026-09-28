"use client";

import { useActionState } from "react";
import { generateManualDraw, type DrawActionState } from "@/app/actions/draws";
import { SubmitButton } from "@/components/SubmitButton";
import { FormError } from "@/components/FormError";

const initialState: DrawActionState = {};

export function GenerateManualDrawForm({
  eventId,
  hasExistingDraw,
}: {
  eventId: string;
  hasExistingDraw: boolean;
}) {
  const action = generateManualDraw.bind(null, eventId);
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (
          hasExistingDraw &&
          !confirm("Reset this draw to a blank bracket for a manual draw? Any existing placements will be lost.")
        ) {
          event.preventDefault();
        }
      }}
      className="flex flex-col gap-2"
    >
      <div>
        <SubmitButton variant="secondary" pendingLabel="Setting up…">
          {hasExistingDraw ? "Regenerate manually" : "Generate draw manually"}
        </SubmitButton>
      </div>
      <FormError message={state.error} />
    </form>
  );
}
