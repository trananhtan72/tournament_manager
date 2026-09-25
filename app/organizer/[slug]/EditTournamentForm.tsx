"use client";

import { useActionState, useState } from "react";
import { updateTournament } from "@/app/actions/tournaments";
import type { TournamentActionState } from "@/app/actions/tournaments";
import { TextField } from "@/components/TextField";
import { SubmitButton } from "@/components/SubmitButton";
import { FormError } from "@/components/FormError";

const initialState: TournamentActionState = {};

function toDateInputValue(date: Date | null) {
  return date ? date.toISOString().slice(0, 10) : "";
}

export function EditTournamentForm({
  tournamentId,
  name: initialName,
  venue: initialVenue,
  startDate,
  endDate,
  registrationDeadline,
  courtCount: initialCourtCount,
  registrationOpensAt,
  withdrawalDeadline,
}: {
  tournamentId: string;
  name: string;
  venue: string;
  startDate: Date;
  endDate: Date;
  registrationDeadline: Date;
  courtCount: number;
  registrationOpensAt: Date | null;
  withdrawalDeadline: Date | null;
}) {
  const updateWithId = updateTournament.bind(null, tournamentId);
  const [state, formAction] = useActionState(updateWithId, initialState);
  const [name, setName] = useState(initialName);
  const [venue, setVenue] = useState(initialVenue);
  const [startDateValue, setStartDateValue] = useState(toDateInputValue(startDate));
  const [endDateValue, setEndDateValue] = useState(toDateInputValue(endDate));
  const [registrationDeadlineValue, setRegistrationDeadlineValue] = useState(
    toDateInputValue(registrationDeadline),
  );
  const [courtCount, setCourtCount] = useState(String(initialCourtCount));
  const [registrationOpensAtValue, setRegistrationOpensAtValue] = useState(toDateInputValue(registrationOpensAt));
  const [withdrawalDeadlineValue, setWithdrawalDeadlineValue] = useState(toDateInputValue(withdrawalDeadline));

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
          value={startDateValue}
          onChange={(e) => setStartDateValue(e.target.value)}
        />
        <TextField
          label="End date"
          name="endDate"
          type="date"
          required
          value={endDateValue}
          onChange={(e) => setEndDateValue(e.target.value)}
        />
        <TextField
          label="Registration deadline"
          name="registrationDeadline"
          type="date"
          required
          value={registrationDeadlineValue}
          onChange={(e) => setRegistrationDeadlineValue(e.target.value)}
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
          value={registrationOpensAtValue}
          onChange={(e) => setRegistrationOpensAtValue(e.target.value)}
        />
        <TextField
          label="Withdrawal deadline (optional)"
          name="withdrawalDeadline"
          type="date"
          value={withdrawalDeadlineValue}
          onChange={(e) => setWithdrawalDeadlineValue(e.target.value)}
        />
      </div>
      <p className="-mt-2 text-xs text-slate-500">
        Leave &quot;Entries open&quot; blank to accept entries straight away, and the withdrawal
        deadline blank to let players withdraw until the registration deadline.
      </p>
      <FormError message={state.error} />
      <div>
        <SubmitButton>Save changes</SubmitButton>
      </div>
    </form>
  );
}
