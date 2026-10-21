"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { requestPasswordReset, type RequestResetActionState } from "@/app/actions/passwordReset";
import { TextField } from "@/components/TextField";
import { SubmitButton } from "@/components/SubmitButton";
import { FormError } from "@/components/FormError";

const initialState: RequestResetActionState = {};

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(requestPasswordReset, initialState);
  const [email, setEmail] = useState("");

  if (state.submitted) {
    return (
      <div className="mx-auto max-w-sm">
        <h1 className="mb-4 text-xl font-semibold">Check your email</h1>
        <p className="text-sm text-muted">
          If an account exists for <span className="font-medium text-text">{email}</span>, we&apos;ve sent a link to
          reset its password. The link expires in an hour.
        </p>
        <p className="mt-4 text-sm text-muted">
          <Link href="/signin" className="underline">
            Back to sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-2 text-xl font-semibold">Reset your password</h1>
      <p className="mb-6 text-sm text-muted">
        Enter the email on your account and we&apos;ll send you a link to choose a new password.
      </p>
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
        <FormError message={state.error} />
        <SubmitButton pendingLabel="Sending…">Send reset link</SubmitButton>
      </form>
      <p className="mt-4 text-sm text-muted">
        <Link href="/signin" className="underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
