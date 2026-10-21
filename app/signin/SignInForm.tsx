"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { signInAction, signInWithGoogle, type AuthActionState } from "@/app/actions/auth";
import { TextField } from "@/components/TextField";
import { SubmitButton } from "@/components/SubmitButton";
import { FormError } from "@/components/FormError";
import { GoogleLogo } from "@/components/icons/GoogleLogo";

const initialState: AuthActionState = {};

export function SignInForm({
  sessionExpired,
  passwordReset,
  callbackUrl,
  googleEnabled,
}: {
  sessionExpired: boolean;
  passwordReset: boolean;
  callbackUrl: string;
  googleEnabled: boolean;
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
      {passwordReset && (
        <p className="mb-4 text-sm text-success">Your password has been reset. Sign in with your new password.</p>
      )}
      {googleEnabled && (
        <>
          <form action={signInWithGoogle.bind(null, callbackUrl)}>
            <SubmitButton variant="secondary" pendingLabel="Redirecting…">
              <span className="flex items-center gap-2">
                <GoogleLogo />
                Continue with Google
              </span>
            </SubmitButton>
          </form>
          <div className="my-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>
        </>
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
        <div className="flex flex-col gap-1">
          <TextField
            label="Password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Link href="/forgot-password" className="self-end text-xs underline text-muted">
            Forgot password?
          </Link>
        </div>
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
