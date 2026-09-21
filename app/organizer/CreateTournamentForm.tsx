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
      <FormError message={state.error} />
      <div>
        <SubmitButton>Create tournament</SubmitButton>
      </div>
    </form>
  );
}
