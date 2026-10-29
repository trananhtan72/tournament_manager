"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { EntryStatus, EventCategory } from "@prisma/client";
import { updateMyRegistrations } from "@/app/actions/registrations";
import type { RegistrationActionState } from "@/app/actions/registrations";
import { Button } from "@/components/Button";
import { SelectField } from "@/components/SelectField";
import { TextField } from "@/components/TextField";
import { SubmitButton } from "@/components/SubmitButton";
import { FormError } from "@/components/FormError";
import { RegulationsDialog } from "@/components/RegulationsDialog";
import { RegulationsContent } from "@/components/RegulationsContent";
import { categoryLabels, isDoublesCategory } from "@/lib/eventLabels";
import { statusText, type MyEntryInfo } from "@/app/t/[slug]/EventRegistrationPanel";
import { useRemountKey } from "@/lib/useRemountKey";
import type { RegulationsDoc } from "@/lib/regulations";

const initialState: RegistrationActionState = {};

export type RegistrableEvent = {
  id: string;
  name: string;
  category: EventCategory;
  entryFee: string;
};

export type CurrentPick = {
  eventId: string;
  eventName: string;
  status: EntryStatus;
  otherPlayer: { name: string; email: string | null } | null;
};

function eventOptionLabel(event: RegistrableEvent): string {
  const parts = [event.name, categoryLabels[event.category]];
  if (event.entryFee) parts.push(`$${event.entryFee}`);
  return parts.join(" — ");
}

function SlotRow({
  index,
  events,
  value,
  onChange,
  unchanged,
  currentPick,
  disabledEventIds,
  partnerEmail,
  onPartnerEmailChange,
}: {
  index: number;
  events: RegistrableEvent[];
  value: string;
  onChange: (value: string) => void;
  unchanged: boolean;
  currentPick: CurrentPick | null;
  disabledEventIds: Set<string>;
  partnerEmail: string;
  onPartnerEmailChange: (value: string) => void;
}) {
  const selectedEvent = events.find((e) => e.id === value) ?? null;
  const showPartnerField = !unchanged && selectedEvent && isDoublesCategory(selectedEvent.category);

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border p-3">
      <SelectField label={`Event ${index}`} name={`eventId_${index}`} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">— None —</option>
        {events.map((event) => (
          <option key={event.id} value={event.id} disabled={disabledEventIds.has(event.id) && event.id !== value}>
            {eventOptionLabel(event)}
          </option>
        ))}
      </SelectField>
      {unchanged && currentPick ? (
        <p className="text-sm text-muted">
          {statusText({
            entryId: "",
            eventName: currentPick.eventName,
            status: currentPick.status,
            myRole: "INITIATOR",
            myConfirmed: true,
            otherPlayer: currentPick.otherPlayer,
          } satisfies MyEntryInfo)}
        </p>
      ) : showPartnerField ? (
        <TextField
          label="Partner's email (optional — leave blank if you need the organizer to pair you)"
          name={`partnerEmail_${index}`}
          type="email"
          value={partnerEmail}
          onChange={(e) => onPartnerEmailChange(e.target.value)}
        />
      ) : null}
    </div>
  );
}

/**
 * The single "Register" / "Edit Registration" entry point: a popup with one
 * slot per event the player may register for (up to the tournament's
 * maxEventsPerUser). Only manages entries where the player is the
 * INITIATOR — an entry they only joined as an invited doubles partner stays
 * out of this dialog and is handled on /dashboard, as before.
 */
export function RegistrationDialog({
  tournamentId,
  maxEventsPerUser,
  registrableEvents,
  currentPicks,
  regulations,
}: {
  tournamentId: string;
  maxEventsPerUser: number;
  registrableEvents: RegistrableEvent[];
  currentPicks: CurrentPick[];
  regulations: RegulationsDoc | null;
}) {
  const updateWithId = updateMyRegistrations.bind(null, tournamentId);
  const [state, formAction] = useActionState(updateWithId, initialState);
  const remountKey = useRemountKey(state);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const prevRemountKey = useRef(remountKey);

  const initialValues = Array.from({ length: maxEventsPerUser }, (_, i) => currentPicks[i]?.eventId ?? "");
  const [values, setValues] = useState<string[]>(initialValues);
  const [partnerEmails, setPartnerEmails] = useState<string[]>(() => Array.from({ length: maxEventsPerUser }, () => ""));

  // After the action completes, this codebase's established convention
  // (see memory: React resets uncontrolled fields after any resolved
  // action) is to resync controlled fields back to fresh server props too —
  // on success that also means closing the popup.
  useEffect(() => {
    if (remountKey !== prevRemountKey.current) {
      prevRemountKey.current = remountKey;
      setValues(initialValues);
      setPartnerEmails(Array.from({ length: maxEventsPerUser }, () => ""));
      if (!state.error) dialogRef.current?.close();
    }
  }, [remountKey, initialValues, maxEventsPerUser, state.error]);

  const pickByEventId = new Map(currentPicks.map((p) => [p.eventId, p]));

  return (
    <>
      <Button type="button" onClick={() => dialogRef.current?.showModal()}>
        {currentPicks.length > 0 ? "Edit Registration" : "Register"}
      </Button>
      <dialog
        ref={dialogRef}
        aria-label="Register for events"
        onClick={(event) => {
          if (event.target === dialogRef.current) dialogRef.current?.close();
        }}
        className="m-auto w-[min(34rem,calc(100vw-2rem))] rounded-lg border border-border bg-surface p-0 text-text shadow-xl backdrop:bg-black/50"
      >
        <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-3">
          <h2 className="text-base font-semibold">Register for events</h2>
          <button
            type="button"
            className="rounded-md px-2 py-1 text-sm text-muted hover:bg-surface-muted"
            onClick={() => dialogRef.current?.close()}
          >
            Close
          </button>
        </div>
        <form action={formAction} className="flex max-h-[75vh] flex-col gap-4 overflow-y-auto px-5 py-4">
          <div className="flex flex-col gap-1 text-sm text-muted">
            <p>To be approved, you&apos;ll need to finish your payment. Details can be found in the regulations.</p>
            {regulations && (
              <RegulationsDialog title="Regulations" triggerLabel="Read the regulations">
                <RegulationsContent doc={regulations} />
              </RegulationsDialog>
            )}
          </div>

          <div className="flex flex-col gap-3">
            {Array.from({ length: maxEventsPerUser }, (_, i) => {
              const value = values[i] ?? "";
              const unchanged = value !== "" && value === initialValues[i];
              const disabledEventIds = new Set(values.filter((v, idx) => idx !== i && v !== ""));
              return (
                <SlotRow
                  key={i}
                  index={i + 1}
                  events={registrableEvents}
                  value={value}
                  onChange={(v) => setValues((prev) => prev.map((old, idx) => (idx === i ? v : old)))}
                  unchanged={unchanged}
                  currentPick={value ? pickByEventId.get(value) ?? null : null}
                  disabledEventIds={disabledEventIds}
                  partnerEmail={partnerEmails[i] ?? ""}
                  onPartnerEmailChange={(v) => setPartnerEmails((prev) => prev.map((old, idx) => (idx === i ? v : old)))}
                />
              );
            })}
          </div>

          <FormError message={state.error} />
          <div className="flex gap-2">
            <SubmitButton pendingLabel="Saving…">Save registrations</SubmitButton>
            <Button type="button" variant="secondary" onClick={() => dialogRef.current?.close()}>
              Cancel
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
