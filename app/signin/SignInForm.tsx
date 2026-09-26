"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { signInAction, type AuthActionState } from "@/app/actions/auth";
import { TextField } from "@/components/TextField";
import { SubmitButton } from "@/components/SubmitButton";
import { FormError } from "@/components/FormError";

const initialState: AuthActionState = {};

export function SignInForm({
  sessionExpired,
  callbackUrl,
}: {
  sessionExpired: boolean;
  callbackUrl: string;
}) {
  const action = signInAction.bind(null, callbackUrl);
  const [state, formAction] = useActionState(action, initialState);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-6 text-xl font-semibold">Sign in</h1>
      {sessionExpired && (
        <p className="mb-4 text-sm text-warning">
          Your session is no longer valid. Please sign in again.
        </p>
      )}
      <form action={formAction} className="flex flex-col gap-4">
        <TextField
          label="Email"
          name="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <TextField
          label="Password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <FormError message={state.error} />
        <SubmitButton>Sign in</SubmitButton>
      </form>
      <p className="mt-4 text-sm text-muted">
        Need an account?{" "}
        <Link
          href={`/signup?callbackUrl=${encodeURIComponent(callbackUrl)}`}
          className="underline"
        >
          Sign up
        </Link>
      </p>
    </div>
  );
}
