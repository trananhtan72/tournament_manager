"use client";

import Link from "next/link";
import type { EntryStatus } from "@prisma/client";
import { withdrawEntry } from "@/app/actions/entries";
import { ActionForm } from "@/components/ActionForm";

export function statusText(entry: MyEntryInfo): string {
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
  eventName: string;
  status: EntryStatus;
  myRole: "INITIATOR" | "PARTNER";
  myConfirmed: boolean;
  otherPlayer: { name: string; email: string | null } | null;
};

export type MyEntryInfoWithEvent = MyEntryInfo & { eventId: string; drawPublished: boolean };

/** One player's registration status for one event, with a withdraw/cancel/respond control as needed. */
export function MyEntryStatus({
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
    <div className="flex flex-col gap-2 rounded-md border border-border px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{entry.eventName}</span>
      </div>
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
