"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { EntryStatus } from "@prisma/client";
import type { RegistrationStatus } from "@/lib/registrationDeadline";
import { usePathname } from "next/navigation";
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
  status: EntryStatus;
  myRole: "INITIATOR" | "PARTNER";
  myConfirmed: boolean;
  otherPlayer: { name: string; email: string | null } | null;
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
    case "PENDING_APPROVAL":
      return entry.otherPlayer
        ? `You're registered with ${entry.otherPlayer.name} — waiting for the organizer to approve your registration.`
        : "You've registered — waiting for the organizer to approve your registration.";
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
  withdrawalOpen,
  drawPublished,
}: {
  entry: MyEntryInfo;
  withdrawalOpen: boolean;
  drawPublished: boolean;
}) {
  const awaitingMyResponse = entry.status === "PENDING_PARTNER" && entry.myRole === "PARTNER";
  const withdrawWithId = withdrawEntry.bind(null, entry.entryId);

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted">{statusText(entry)}</p>
      {awaitingMyResponse ? (
        <Link href="/dashboard" className="text-sm underline">
          Respond from your dashboard →
        </Link>
      ) : withdrawalOpen && drawPublished ? (
        <p className="text-sm text-muted">
          The draw has been published — contact the organizer if you need to withdraw.
        </p>
      ) : withdrawalOpen ? (
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
  registrationStatus,
  registrationOpensLabel,
  withdrawalOpen,
  drawPublished,
  signedIn,
  myEntry,
}: {
  eventId: string;
  isDoubles: boolean;
  registrationStatus: RegistrationStatus;
  /** When entries open, formatted — shown while registration hasn't started. */
  registrationOpensLabel: string | null;
  withdrawalOpen: boolean;
  drawPublished: boolean;
  signedIn: boolean;
  myEntry: MyEntryInfo | null;
}) {
  const pathname = usePathname();

  if (signedIn && myEntry) {
    return <MyEntryStatus entry={myEntry} withdrawalOpen={withdrawalOpen} drawPublished={drawPublished} />;
  }

  if (registrationStatus === "not_open") {
    return (
      <p className="text-sm text-muted">
        Registration opens{registrationOpensLabel ? ` on ${registrationOpensLabel}` : " soon"}.
      </p>
    );
  }
  if (registrationStatus === "closed") {
    return <p className="text-sm text-muted">Registration is closed.</p>;
  }

  if (!signedIn) {
    return (
      <Link
        href={`/signin?callbackUrl=${encodeURIComponent(pathname)}`}
        className="text-sm underline"
      >
        Sign in to register
      </Link>
    );
  }

  return isDoubles ? (
    <DoublesRegisterForms eventId={eventId} />
  ) : (
    <SinglesRegisterForm eventId={eventId} />
  );
}
