"use client";

import { Fragment, useActionState, useState } from "react";
import Link from "next/link";
import { updateEvent, deleteEvent } from "@/app/actions/events";
import type { EventActionState } from "@/app/actions/events";
import { SubmitButton } from "@/components/SubmitButton";
import { FormError } from "@/components/FormError";
import { TextField } from "@/components/TextField";
import { ActionForm } from "@/components/ActionForm";
import { EventNameFields } from "@/components/EventNameFields";
import { EventFormatFields } from "@/components/EventFormatFields";
import { TieFormatFields } from "@/components/TieFormatFields";
import { useRemountKey } from "@/lib/useRemountKey";
import type { DrawFormat, EventCategory } from "@prisma/client";
import type { TieFormatSlotInput } from "@/lib/tournament/tieFormat";

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
  tieFormatSlots,
  entryFee: initialEntryFee,
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
  tieFormatSlots: TieFormatSlotInput[];
  entryFee: string;
  entryCount: number;
  pendingApprovalCount: number;
}) {
  const updateWithId = updateEvent.bind(null, eventId);
  const deleteWithId = deleteEvent.bind(null, eventId);
  const [state, formAction] = useActionState(updateWithId, initialState);
  const remountKey = useRemountKey(state);
  const [liveCategory, setLiveCategory] = useState(category);
  const [entryFee, setEntryFee] = useState(initialEntryFee);

  return (
    <li className="flex flex-col gap-3 rounded-md border border-border px-4 py-3">
      <form action={formAction} className="flex flex-col gap-3">
        <Fragment key={remountKey}>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <EventNameFields initialName={name} initialCategory={category} onCategoryChange={setLiveCategory} />
            <EventFormatFields
              category={liveCategory}
              initialDrawFormat={drawFormat}
              initialGameFormat={{ gamesPerMatch, pointsPerGame }}
              initialKnockoutGameFormat={
                knockoutGamesPerMatch !== null && knockoutPointsPerGame !== null
                  ? { gamesPerMatch: knockoutGamesPerMatch, pointsPerGame: knockoutPointsPerGame }
                  : null
              }
            />
            <TextField
              label="Entry fee (optional)"
              name="entryFee"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              className="w-28"
              value={entryFee}
              onChange={(e) => setEntryFee(e.target.value)}
            />
            <SubmitButton variant="secondary">Update</SubmitButton>
          </div>
          {liveCategory === "TEAM" && <TieFormatFields initialSlots={tieFormatSlots} />}
        </Fragment>
      </form>
      <FormError message={state.error} />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href={`/organizer/${tournamentSlug}/entries/${eventId}`}
            className="text-sm underline"
          >
            Manage entries →
          </Link>
          <span className="text-sm text-muted">
            {entryCount} {entryCount === 1 ? "entry" : "entries"}
          </span>
          {pendingApprovalCount > 0 && (
            <span className="rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning">
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
