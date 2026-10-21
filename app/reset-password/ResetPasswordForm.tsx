"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { resetPassword, type ResetPasswordActionState } from "@/app/actions/passwordReset";
import { TextField } from "@/components/TextField";
import { SubmitButton } from "@/components/SubmitButton";
import { FormError } from "@/components/FormError";

const initialState: ResetPasswordActionState = {};

export function ResetPasswordForm({ token }: { token: string }) {
  const action = resetPassword.bind(null, token);
  const [state, formAction] = useActionState(action, initialState);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  if (state.success) {
    return (
      <div className="mx-auto max-w-sm">
        <h1 className="mb-4 text-xl font-semibold">Password updated</h1>
        <p className="text-sm text-muted">Your password has been reset. Sign in with your new password.</p>
        <p className="mt-4 text-sm text-muted">
          <Link href="/signin?passwordReset=1" className="underline">
            Go to sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-6 text-xl font-semibold">Choose a new password</h1>
      <form action={formAction} className="flex flex-col gap-4">
        <TextField
          label="New password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <TextField
          label="Confirm new password"
          name="confirmPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
        <FormError message={state.error} />
        <SubmitButton pendingLabel="Saving…">Reset password</SubmitButton>
      </form>
      <p className="mt-4 text-sm text-muted">
        <Link href="/signin" className="underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
