"use client";

import { useState, useTransition } from "react";
import { addReferee } from "@/app/actions/referees";
import { Button } from "@/components/Button";
import { FormError } from "@/components/FormError";
import { TextField } from "@/components/TextField";

/**
 * Kept controlled and driven by hand (not useActionState) so the email stays
 * put when it's refused — a typo is easy to fix — and clears once added.
 */
export function AddRefereeForm({ tournamentId }: { tournamentId: string }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [added, setAdded] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setAdded(null);
    startTransition(async () => {
      const result = await addReferee(tournamentId, {}, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setError(undefined);
      setAdded(String(formData.get("email")));
      setEmail("");
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-3">
        <TextField
          label="Referee's email"
          name="email"
          type="email"
          required
          autoComplete="off"
          placeholder="name@example.com"
          className="w-72"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Button type="submit" disabled={pending}>
          {pending ? "Adding…" : "Add referee"}
        </Button>
      </div>
      <FormError message={error} />
      {added && !error && <p className="text-sm text-success">Added {added}. They&apos;ve been notified.</p>}
    </form>
  );
}
