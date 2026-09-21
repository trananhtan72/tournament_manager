"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  registerSingles,
  registerNeedsPartner,
  registerWithPartner,
  withdrawEntry,
  type EntryActionState,
} from "@/app/actions/entries";
import { TextField } from "@/components/TextField";
import { SubmitButton } from "@/components/SubmitButton";
import { FormError } from "@/components/FormError";
import { ActionForm } from "@/components/ActionForm";

const initialState: EntryActionState = {};

export type MyEntryInfo = {
  entryId: string;
  status: "NEEDS_PARTNER" | "PENDING_PARTNER" | "CONFIRMED";
  myRole: "INITIATOR" | "PARTNER";
  myConfirmed: boolean;
  otherPlayer: { name: string; email: string } | null;
};

function SinglesRegisterForm({ eventId }: { eventId: string }) {
  const registerAction = registerSingles.bind(null, eventId);
  const [state, formAction] = useActionState(registerAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <div>
        <SubmitButton pendingLabel="Registering…">Register</SubmitButton>
      </div>
      <FormError message={state.error} />
    </form>
  );
}

function DoublesRegisterForms({ eventId }: { eventId: string }) {
  const withPartnerAction = registerWithPartner.bind(null, eventId);
  const [partnerState, partnerFormAction] = useActionState(withPartnerAction, initialState);
  const needsPartnerAction = registerNeedsPartner.bind(null, eventId);
  const [needsState, needsFormAction] = useActionState(needsPartnerAction, initialState);

  return (
    <div className="flex flex-col gap-4">
      <form action={partnerFormAction} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <TextField
          label="Partner's email"
          name="partnerEmail"
          type="email"
          required
          className="sm:w-64"
        />
        <SubmitButton pendingLabel="Sending invite…">Register with partner</SubmitButton>
      </form>
      <FormError message={partnerState.error} />

      <form action={needsFormAction}>
        <SubmitButton variant="secondary" pendingLabel="Registering…">
          Register — I need a partner
        </SubmitButton>
      </form>
      <FormError message={needsState.error} />
    </div>
  );
}

function statusText(entry: MyEntryInfo): string {
  switch (entry.status) {
    case "CONFIRMED":
      return entry.otherPlayer
        ? `You're registered with ${entry.otherPlayer.name}.`
        : "You're registered.";
    case "NEEDS_PARTNER":
      return "You're registered — waiting for the organizer to pair you with a partner.";
    case "PENDING_PARTNER":
      return entry.myRole === "INITIATOR"
        ? `Invitation sent to ${entry.otherPlayer?.email} — waiting for them to confirm.`
        : `${entry.otherPlayer?.name} invited you to be their partner.`;
  }
}

function MyEntryStatus({
  entry,
  registrationOpen,
}: {
  entry: MyEntryInfo;
  registrationOpen: boolean;
}) {
  const awaitingMyResponse = entry.status === "PENDING_PARTNER" && entry.myRole === "PARTNER";
  const withdrawWithId = withdrawEntry.bind(null, entry.entryId);

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-slate-700 dark:text-slate-300">{statusText(entry)}</p>
      {awaitingMyResponse ? (
        <Link href="/dashboard" className="text-sm underline">
          Respond from your dashboard →
        </Link>
      ) : registrationOpen ? (
        <div>
          <ActionForm
            action={withdrawWithId}
            variant="secondary"
            label={
              entry.status === "PENDING_PARTNER" ? "Cancel invitation" : "Withdraw"
            }
            pendingLabel="Withdrawing…"
            confirmMessage="Withdraw from this event? This cannot be undone."
          />
        </div>
      ) : null}
    </div>
  );
}

export function EventRegistrationPanel({
  eventId,
  isDoubles,
  registrationOpen,
  signedIn,
  myEntry,
}: {
  eventId: string;
  isDoubles: boolean;
  registrationOpen: boolean;
  signedIn: boolean;
  myEntry: MyEntryInfo | null;
}) {
  if (!signedIn) {
    return (
      <Link href="/signin" className="text-sm underline">
        Sign in to register
      </Link>
    );
  }

  if (myEntry) {
    return (
      <MyEntryStatus entry={myEntry} registrationOpen={registrationOpen} />
    );
  }

  if (!registrationOpen) {
    return <p className="text-sm text-slate-500">Registration is closed.</p>;
  }

  return isDoubles ? (
    <DoublesRegisterForms eventId={eventId} />
  ) : (
    <SinglesRegisterForm eventId={eventId} />
  );
}
