"use client";

import { useActionState, useRef } from "react";
import { setEntrySeed, type DrawActionState } from "@/app/actions/draws";
import { FormError } from "@/components/FormError";

const initialState: DrawActionState = {};
const SEED_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8];

export function EntrySeedField({
  entryId,
  currentSeed,
  disabled,
}: {
  entryId: string;
  currentSeed: number | null;
  disabled: boolean;
}) {
  const action = setEntrySeed.bind(null, entryId);
  const [state, formAction] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form action={formAction} ref={formRef} className="flex flex-col items-end gap-1">
      <label className="flex items-center gap-2 text-sm">
        Seed
        <select
          name="seed"
          defaultValue={currentSeed ?? ""}
          disabled={disabled}
          onChange={() => formRef.current?.requestSubmit()}
          className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900 outline-none focus:border-slate-500 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
        >
          <option value="">Unseeded</option>
          {SEED_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <FormError message={state.error} />
    </form>
  );
}
