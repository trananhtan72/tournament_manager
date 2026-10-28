"use client";

import { useState, useActionState } from "react";
import type { EventCategory } from "@prisma/client";
import { createEvent } from "@/app/actions/events";
import type { EventActionState } from "@/app/actions/events";
import { SubmitButton } from "@/components/SubmitButton";
import { FormError } from "@/components/FormError";
import { EventNameFields } from "@/components/EventNameFields";
import { EventFormatFields } from "@/components/EventFormatFields";
import { TieFormatFields } from "@/components/TieFormatFields";

const initialState: EventActionState = {};

export function AddEventForm({ tournamentId }: { tournamentId: string }) {
  const createWithId = createEvent.bind(null, tournamentId);
  const [state, formAction] = useActionState(createWithId, initialState);
  const [category, setCategory] = useState<EventCategory>("SINGLES");

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
        <EventNameFields onCategoryChange={setCategory} />
        <EventFormatFields category={category} />
        <SubmitButton>Add event</SubmitButton>
      </div>
      {category === "TEAM" && <TieFormatFields />}
      <FormError message={state.error} />
    </form>
  );
}
