"use client";

import { useActionState, useRef, type ReactNode, type RefObject } from "react";
import Link from "next/link";
import type { EntryStatus } from "@prisma/client";
import type { RegistrationStatus } from "@/lib/registrationDeadline";
import type { RegulationsDoc } from "@/lib/regulations";
import { usePathname } from "next/navigation";
import {
  registerSingles,
  registerNeedsPartner,
  registerWithPartner,
  withdrawEntry,
  type EntryActionState,
} from "@/app/actions/entries";
import { TextField } from "@/components/TextField";
import { Button } from "@/components/Button";
import { SubmitButton } from "@/components/SubmitButton";
import { FormError } from "@/components/FormError";
import { ActionForm } from "@/components/ActionForm";
import { RegulationsDialog } from "@/components/RegulationsDialog";
import { RegulationsContent } from "@/components/RegulationsContent";

const initialState: EntryActionState = {};

/**
 * Shown when a player clicks a "Register" button, before the registration
 * itself goes through — approval depends on finishing payment, which
 * otherwise isn't mentioned anywhere else in the registration flow. Must be
 * rendered as a descendant of the `<form>` it belongs to: the real submit
 * button lives inside it (as `children`), and a `<dialog>` shown via
 * `showModal()` keeps its place in the DOM for form-association purposes, so
 * clicking that button still submits the right form.
 */
function PaymentNoticeDialog({
  dialogRef,
  tournamentName,
  regulations,
  children,
}: {
  dialogRef: RefObject<HTMLDialogElement | null>;
  tournamentName: string;
  regulations: RegulationsDoc | null;
  children: ReactNode;
}) {
  return (
    <dialog
      ref={dialogRef}
      aria-label="Payment required for approval"
      onClick={(event) => {
        if (event.target === dialogRef.current) dialogRef.current?.close();
      }}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-lg border border-border bg-surface p-0 text-text shadow-xl backdrop:bg-black/50"
    >
      <div className="flex flex-col gap-3 p-5">
        <p className="text-sm text-text">
          To be approved, you&apos;ll need to finish your payment. Details can be found in the regulations.
        </p>
        {/* Outside the <p> above on purpose: RegulationsDialog renders a <dialog>, which isn't valid
            nested inside a <p> (a browser auto-closes the <p> early to cope, which then mismatches
            what React rendered on the server and triggers a hydration error). */}
        {regulations && (
          <RegulationsDialog title={`Regulations — ${tournamentName}`} triggerLabel="Read the regulations">
            <RegulationsContent doc={regulations} />
          </RegulationsDialog>
        )}
        <div className="flex flex-wrap gap-2">{children}</div>
      </div>
    </dialog>
  );
}

function SinglesRegisterForm({
  eventId,
  tournamentName,
  regulations,
}: {
  eventId: string;
  tournamentName: string;
  regulations: RegulationsDoc | null;
}) {
  const registerAction = registerSingles.bind(null, eventId);
  const [state, formAction] = useActionState(registerAction, initialState);
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <div>
        <Button type="button" onClick={() => dialogRef.current?.showModal()}>
          Register
        </Button>
      </div>
      <PaymentNoticeDialog dialogRef={dialogRef} tournamentName={tournamentName} regulations={regulations}>
        <SubmitButton pendingLabel="Registering…">Register</SubmitButton>
        <Button type="button" variant="secondary" onClick={() => dialogRef.current?.close()}>
          Cancel
        </Button>
      </PaymentNoticeDialog>
      <FormError message={state.error} />
    </form>
  );
}

function DoublesRegisterForms({
  eventId,
  tournamentName,
  regulations,
}: {
  eventId: string;
  tournamentName: string;
  regulations: RegulationsDoc | null;
}) {
  const withPartnerAction = registerWithPartner.bind(null, eventId);
  const [partnerState, partnerFormAction] = useActionState(withPartnerAction, initialState);
  const partnerDialogRef = useRef<HTMLDialogElement>(null);

  const needsPartnerAction = registerNeedsPartner.bind(null, eventId);
  const [needsState, needsFormAction] = useActionState(needsPartnerAction, initialState);
  const needsDialogRef = useRef<HTMLDialogElement>(null);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <form action={partnerFormAction} className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <TextField label="Partner's email" name="partnerEmail" type="email" required className="sm:w-64" />
          <Button type="button" onClick={() => partnerDialogRef.current?.showModal()}>
            Register with partner
          </Button>
          <PaymentNoticeDialog dialogRef={partnerDialogRef} tournamentName={tournamentName} regulations={regulations}>
            <SubmitButton pendingLabel="Sending invite…">Register with partner</SubmitButton>
            <Button type="button" variant="secondary" onClick={() => partnerDialogRef.current?.close()}>
              Cancel
            </Button>
          </PaymentNoticeDialog>
        </form>
        <FormError message={partnerState.error} />
      </div>

      <div>
        <form action={needsFormAction}>
          <Button type="button" variant="secondary" onClick={() => needsDialogRef.current?.showModal()}>
            Register — I need a partner
          </Button>
          <PaymentNoticeDialog dialogRef={needsDialogRef} tournamentName={tournamentName} regulations={regulations}>
            <SubmitButton variant="secondary" pendingLabel="Registering…">
              Register — I need a partner
            </SubmitButton>
            <Button type="button" variant="secondary" onClick={() => needsDialogRef.current?.close()}>
              Cancel
            </Button>
          </PaymentNoticeDialog>
        </form>
        <FormError message={needsState.error} />
      </div>
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

export type MyEntryInfo = {
  entryId: string;
  status: EntryStatus;
  myRole: "INITIATOR" | "PARTNER";
  myConfirmed: boolean;
  otherPlayer: { name: string; email: string | null } | null;
};

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
  tournamentName,
  regulations,
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
  tournamentName: string;
  regulations: RegulationsDoc | null;
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
    <DoublesRegisterForms eventId={eventId} tournamentName={tournamentName} regulations={regulations} />
  ) : (
    <SinglesRegisterForm eventId={eventId} tournamentName={tournamentName} regulations={regulations} />
  );
}
