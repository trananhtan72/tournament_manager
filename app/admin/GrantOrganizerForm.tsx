"use client";

import { useState, useTransition } from "react";
import { grantOrganizerAccess } from "@/app/actions/admin";
import { Button } from "@/components/Button";
import { FormError } from "@/components/FormError";
import { TextField } from "@/components/TextField";

/**
 * Kept controlled and driven by hand (not useActionState) so the email stays
 * put when it's refused — a typo is easy to fix — and clears once granted.
 */
export function GrantOrganizerForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [granted, setGranted] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setGranted(null);
    startTransition(async () => {
      const result = await grantOrganizerAccess({}, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setError(undefined);
      setGranted(String(formData.get("email")));
      setEmail("");
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-3">
        <TextField
          label="Their email"
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
          {pending ? "Granting…" : "Grant access"}
        </Button>
      </div>
      <FormError message={error} />
      {granted && !error && (
        <p className="text-sm text-success">Granted {granted}. They&apos;ve been notified.</p>
      )}
    </form>
  );
}
