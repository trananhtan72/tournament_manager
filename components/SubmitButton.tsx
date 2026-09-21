"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/Button";

type SubmitButtonProps = {
  children: React.ReactNode;
  pendingLabel?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
};

export function SubmitButton({
  children,
  pendingLabel = "Saving…",
  variant,
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant={variant} disabled={pending}>
      {pending ? pendingLabel : children}
    </Button>
  );
}
