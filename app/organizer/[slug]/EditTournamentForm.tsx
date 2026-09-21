"use client";

import { useActionState, useState } from "react";
import { updateTournament } from "@/app/actions/tournaments";
import type { TournamentActionState } from "@/app/actions/tournaments";
import { TextField } from "@/components/TextField";
import { SubmitButton } from "@/components/SubmitButton";
import { FormError } from "@/components/FormError";

const initialState: TournamentActionState = {};

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function EditTournamentForm({
  tournamentId,
  name: initialName,
  venue: initialVenue,
  startDate,
  endDate,
  registrationDeadline,
}: {
  tournamentId: string;
  name: string;
  venue: string;
  startDate: Date;
  endDate: Date;
  registrationDeadline: Date;
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
      <FormError message={state.error} />
      <div>
        <SubmitButton>Save changes</SubmitButton>
      </div>
    </form>
  );
}
