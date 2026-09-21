import { type ComponentProps } from "react";

const variantClasses = {
  primary:
    "bg-slate-900 text-white hover:bg-slate-700 disabled:bg-slate-400 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200",
  secondary:
    "bg-transparent text-slate-900 border border-slate-300 hover:bg-slate-100 dark:text-white dark:border-slate-600 dark:hover:bg-slate-800",
  danger:
    "bg-red-600 text-white hover:bg-red-500 disabled:bg-red-300",
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
