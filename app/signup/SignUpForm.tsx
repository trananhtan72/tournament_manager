"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { signUp, type AuthActionState } from "@/app/actions/auth";
import { TextField } from "@/components/TextField";
import { SubmitButton } from "@/components/SubmitButton";
import { FormError } from "@/components/FormError";

const initialState: AuthActionState = {};

export function SignUpForm({ callbackUrl }: { callbackUrl: string }) {
  const action = signUp.bind(null, callbackUrl);
  const [state, formAction] = useActionState(action, initialState);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-6 text-xl font-semibold">Create an account</h1>
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
      <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
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
