"use client";

import { useActionState, useState } from "react";
import { createTournament } from "@/app/actions/tournaments";
import type { TournamentActionState } from "@/app/actions/tournaments";
import { TextField } from "@/components/TextField";
import { SubmitButton } from "@/components/SubmitButton";
import { FormError } from "@/components/FormError";

const initialState: TournamentActionState = {};

export function CreateTournamentForm() {
  const [state, formAction] = useActionState(createTournament, initialState);
  const [name, setName] = useState("");
  const [venue, setVenue] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [registrationDeadline, setRegistrationDeadline] = useState("");
  const [courtCount, setCourtCount] = useState("12");
  const [registrationOpensAt, setRegistrationOpensAt] = useState("");
  const [withdrawalDeadline, setWithdrawalDeadline] = useState("");

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <TextField
        label="Tournament name"
        name="name"
        type="text"
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <TextField
        label="Venue"
        name="venue"
        type="text"
        required
        value={venue}
        onChange={(e) => setVenue(e.target.value)}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <TextField
          label="Start date"
          name="startDate"
          type="date"
          required
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
        <TextField
          label="End date"
          name="endDate"
          type="date"
          required
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
        />
        <TextField
          label="Registration deadline"
          name="registrationDeadline"
          type="date"
          required
          value={registrationDeadline}
          onChange={(e) => setRegistrationDeadline(e.target.value)}
        />
      </div>
      <TextField
        label="Number of courts"
        name="courtCount"
        type="number"
        inputMode="numeric"
        required
        min={1}
        max={50}
        step={1}
        className="w-32"
        value={courtCount}
        onChange={(e) => setCourtCount(e.target.value)}
      />
      <p className="-mt-2 text-xs text-slate-500">
        Matches are assigned to Court 1 … Court N when they&apos;re scored live, and each court gets its own
        scoreboard screen for a TV or tablet.
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          label="Entries open (optional)"
          name="registrationOpensAt"
          type="date"
          value={registrationOpensAt}
          onChange={(e) => setRegistrationOpensAt(e.target.value)}
        />
        <TextField
          label="Withdrawal deadline (optional)"
          name="withdrawalDeadline"
          type="date"
          value={withdrawalDeadline}
          onChange={(e) => setWithdrawalDeadline(e.target.value)}
        />
      </div>
      <p className="-mt-2 text-xs text-slate-500">
        Leave &quot;Entries open&quot; blank to accept entries straight away, and the withdrawal
        deadline blank to let players withdraw until the registration deadline.
      </p>
      <FormError message={state.error} />
      <div>
        <SubmitButton>Create tournament</SubmitButton>
      </div>
    </form>
  );
}
