"use client";

import { SubmitButton } from "@/components/SubmitButton";

type ActionFormProps = {
  action: () => Promise<void>;
  label: string;
  variant?: React.ComponentProps<typeof SubmitButton>["variant"];
  confirmMessage?: string;
  pendingLabel?: string;
};

export function ActionForm({
  action,
  label,
  variant = "secondary",
  confirmMessage,
  pendingLabel = "Working…",
}: ActionFormProps) {
  return (
    <form
      action={action}
      onSubmit={
        confirmMessage
          ? (event) => {
              if (!confirm(confirmMessage)) {
                event.preventDefault();
              }
            }
          : undefined
      }
    >
      <SubmitButton variant={variant} pendingLabel={pendingLabel}>
        {label}
      </SubmitButton>
    </form>
  );
}
