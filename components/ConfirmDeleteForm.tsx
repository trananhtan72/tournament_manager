"use client";

import { SubmitButton } from "@/components/SubmitButton";

type ConfirmDeleteFormProps = {
  action: () => Promise<void>;
  confirmMessage: string;
  label?: string;
};

export function ConfirmDeleteForm({
  action,
  confirmMessage,
  label = "Delete",
}: ConfirmDeleteFormProps) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
    >
      <SubmitButton variant="danger" pendingLabel="Deleting…">
        {label}
      </SubmitButton>
    </form>
  );
}
