"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { signInAction, type AuthActionState } from "@/app/actions/auth";
import { TextField } from "@/components/TextField";
import { SubmitButton } from "@/components/SubmitButton";
import { FormError } from "@/components/FormError";

const initialState: AuthActionState = {};

export default function SignInPage() {
  const [state, formAction] = useActionState(signInAction, initialState);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-6 text-xl font-semibold">Sign in</h1>
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
      <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
        Need an account?{" "}
        <Link href="/signup" className="underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}
