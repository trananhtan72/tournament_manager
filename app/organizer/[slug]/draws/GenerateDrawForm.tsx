"use client";

import { useActionState } from "react";
import { generateDraw, type DrawActionState } from "@/app/actions/draws";
import { SubmitButton } from "@/components/SubmitButton";
import { FormError } from "@/components/FormError";

const initialState: DrawActionState = {};

export function GenerateDrawForm({
  eventId,
  hasExistingDraw,
}: {
  eventId: string;
  hasExistingDraw: boolean;
}) {
  const action = generateDraw.bind(null, eventId);
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <div>
        <SubmitButton pendingLabel="Generating…">
          {hasExistingDraw ? "Regenerate draw" : "Generate draw"}
        </SubmitButton>
      </div>
      <FormError message={state.error} />
    </form>
  );
}
