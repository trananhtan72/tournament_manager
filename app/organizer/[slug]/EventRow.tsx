"use client";

import { useActionState } from "react";
import Link from "next/link";
import { updateEvent, deleteEvent } from "@/app/actions/events";
import type { EventActionState } from "@/app/actions/events";
import { SelectField } from "@/components/SelectField";
import { SubmitButton } from "@/components/SubmitButton";
import { FormError } from "@/components/FormError";
import { ActionForm } from "@/components/ActionForm";
import { EventNameFields } from "@/components/EventNameFields";
import { drawFormatLabels } from "@/lib/eventLabels";
import { useRemountKey } from "@/lib/useRemountKey";
import type { DrawFormat, EventCategory } from "@prisma/client";

const initialState: EventActionState = {};

export function EventRow({
  tournamentSlug,
  eventId,
  name,
  category,
  drawFormat,
  entryCount,
}: {
  tournamentSlug: string;
  eventId: string;
  name: string;
  category: EventCategory;
  drawFormat: DrawFormat;
  entryCount: number;
}) {
  const updateWithId = updateEvent.bind(null, eventId);
  const deleteWithId = deleteEvent.bind(null, eventId);
  const [state, formAction] = useActionState(updateWithId, initialState);
  const remountKey = useRemountKey(state);

  return (
    <li className="flex flex-col gap-3 rounded-md border border-slate-200 px-4 py-3 dark:border-slate-700">
      <form action={formAction} className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <EventNameFields key={remountKey} initialName={name} initialCategory={category} />
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href={`/organizer/${tournamentSlug}/${eventId}`}
            className="text-sm underline"
          >
            Manage entries →
          </Link>
          <span className="text-sm text-slate-500">
            {entryCount} {entryCount === 1 ? "entry" : "entries"}
          </span>
        </div>
        <ActionForm
          action={deleteWithId}
          variant="danger"
          label="Delete"
          pendingLabel="Deleting…"
          confirmMessage={`Delete ${name}? This cannot be undone.`}
        />
      </div>
    </li>
  );
}
