"use client";

import { Fragment, useActionState } from "react";
import Link from "next/link";
import { updateEvent, deleteEvent } from "@/app/actions/events";
import type { EventActionState } from "@/app/actions/events";
import { SubmitButton } from "@/components/SubmitButton";
import { FormError } from "@/components/FormError";
import { ActionForm } from "@/components/ActionForm";
import { EventNameFields } from "@/components/EventNameFields";
import { EventFormatFields } from "@/components/EventFormatFields";
import { useRemountKey } from "@/lib/useRemountKey";
import type { DrawFormat, EventCategory } from "@prisma/client";

const initialState: EventActionState = {};

export function EventRow({
  tournamentSlug,
  eventId,
  name,
  category,
  drawFormat,
  gamesPerMatch,
  pointsPerGame,
  knockoutGamesPerMatch,
  knockoutPointsPerGame,
  entryCount,
  pendingApprovalCount,
}: {
  tournamentSlug: string;
  eventId: string;
  name: string;
  category: EventCategory;
  drawFormat: DrawFormat;
  gamesPerMatch: number;
  pointsPerGame: number;
  knockoutGamesPerMatch: number | null;
  knockoutPointsPerGame: number | null;
  entryCount: number;
  pendingApprovalCount: number;
}) {
  const updateWithId = updateEvent.bind(null, eventId);
  const deleteWithId = deleteEvent.bind(null, eventId);
  const [state, formAction] = useActionState(updateWithId, initialState);
  const remountKey = useRemountKey(state);

  return (
    <li className="flex flex-col gap-3 rounded-md border border-slate-200 px-4 py-3 dark:border-slate-700">
      <form action={formAction} className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <Fragment key={remountKey}>
          <EventNameFields initialName={name} initialCategory={category} />
          <EventFormatFields
            initialDrawFormat={drawFormat}
            initialGameFormat={{ gamesPerMatch, pointsPerGame }}
            initialKnockoutGameFormat={
              knockoutGamesPerMatch !== null && knockoutPointsPerGame !== null
                ? { gamesPerMatch: knockoutGamesPerMatch, pointsPerGame: knockoutPointsPerGame }
                : null
            }
          />
        </Fragment>
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
          {pendingApprovalCount > 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900 dark:text-amber-200">
              {pendingApprovalCount} awaiting approval
            </span>
          )}
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
