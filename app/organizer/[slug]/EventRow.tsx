"use client";

import { useActionState } from "react";
import { updateEvent, deleteEvent } from "@/app/actions/events";
import type { EventActionState } from "@/app/actions/events";
import { SelectField } from "@/components/SelectField";
import { SubmitButton } from "@/components/SubmitButton";
import { FormError } from "@/components/FormError";
import { ConfirmDeleteForm } from "@/components/ConfirmDeleteForm";
import { eventTypeLabels, drawFormatLabels } from "@/lib/eventLabels";
import type { DrawFormat, EventType } from "@prisma/client";

const initialState: EventActionState = {};

export function EventRow({
  eventId,
  type,
  drawFormat,
}: {
  eventId: string;
  type: EventType;
  drawFormat: DrawFormat;
}) {
  const updateWithId = updateEvent.bind(null, eventId);
  const deleteWithId = deleteEvent.bind(null, eventId);
  const [state, formAction] = useActionState(updateWithId, initialState);

  return (
    <li className="flex flex-col gap-3 rounded-md border border-slate-200 px-4 py-3 dark:border-slate-700">
      <form action={formAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <SelectField label="Event type" name="type" defaultValue={type} required>
          {Object.entries(eventTypeLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Draw format"
          name="drawFormat"
          defaultValue={drawFormat}
          required
        >
          {Object.entries(drawFormatLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </SelectField>
        <div className="flex gap-2">
          <SubmitButton variant="secondary">Update</SubmitButton>
        </div>
      </form>
      <FormError message={state.error} />
      <ConfirmDeleteForm
        action={deleteWithId}
        confirmMessage={`Delete ${eventTypeLabels[type]}? This cannot be undone.`}
      />
    </li>
  );
}
