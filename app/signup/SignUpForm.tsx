"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { signUp, signInWithGoogle, type AuthActionState } from "@/app/actions/auth";
import { TextField } from "@/components/TextField";
import { SubmitButton } from "@/components/SubmitButton";
import { FormError } from "@/components/FormError";
import { GoogleLogo } from "@/components/icons/GoogleLogo";

const initialState: AuthActionState = {};

export function SignUpForm({ callbackUrl, googleEnabled }: { callbackUrl: string; googleEnabled: boolean }) {
  const action = signUp.bind(null, callbackUrl);
  const [state, formAction] = useActionState(action, initialState);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-6 text-xl font-semibold">Create an account</h1>
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
          label="Name"
          name="name"
          type="text"
          required
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
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
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <FormError message={state.error} />
        <SubmitButton>Sign up</SubmitButton>
      </form>
      <p className="mt-4 text-sm text-muted">
        Already have an account?{" "}
        <Link
          href={`/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`}
          className="underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
