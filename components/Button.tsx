import { type ComponentProps } from "react";

const variantClasses = {
  primary: "bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-primary/40",
  secondary: "bg-transparent text-text border border-border hover:bg-surface-muted",
  danger: "bg-error text-error-foreground hover:bg-error/90 disabled:bg-error/40",
} as const;

type ButtonProps = ComponentProps<"button"> & {
  variant?: keyof typeof variantClasses;
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed ${variantClasses[variant]} ${className}`}
      {...props}
    />
  );
}
