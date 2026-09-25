"use client";

import { useActionState } from "react";
import { createEvent } from "@/app/actions/events";
import type { EventActionState } from "@/app/actions/events";
import { SubmitButton } from "@/components/SubmitButton";
import { FormError } from "@/components/FormError";
import { EventNameFields } from "@/components/EventNameFields";
import { EventFormatFields } from "@/components/EventFormatFields";

const initialState: EventActionState = {};

export function AddEventForm({ tournamentId }: { tournamentId: string }) {
  const createWithId = createEvent.bind(null, tournamentId);
  const [state, formAction] = useActionState(createWithId, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
        <EventNameFields />
        <EventFormatFields />
        <SubmitButton>Add event</SubmitButton>
      </div>
      <FormError message={state.error} />
    </form>
  );
}
