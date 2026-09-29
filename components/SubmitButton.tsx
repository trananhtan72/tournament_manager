"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/Button";

type SubmitButtonProps = {
  children: React.ReactNode;
  pendingLabel?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  /** Sent with the form when this is the button that submitted it, so one form can have several. */
  name?: string;
  value?: string;
  /** Skips the form's native required/pattern checks for this specific button — for one whose action doesn't need every field a sibling button does. */
  formNoValidate?: boolean;
};

export function SubmitButton({
  children,
  pendingLabel = "Saving…",
  variant,
  name,
  value,
  formNoValidate,
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant={variant} disabled={pending} name={name} value={value} formNoValidate={formNoValidate}>
      {pending ? pendingLabel : children}
    </Button>
  );
}
