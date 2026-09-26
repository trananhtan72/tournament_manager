import { type ComponentProps } from "react";

type SelectFieldProps = ComponentProps<"select"> & {
  label: string;
  name: string;
};

export function SelectField({
  label,
  name,
  className = "",
  children,
  ...props
}: SelectFieldProps) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-text">
      {label}
      <select
        id={name}
        name={name}
        className={`rounded-md border border-border bg-surface px-3 py-2 text-sm font-normal text-text outline-none focus:border-primary ${className}`}
        {...props}
      >
        {children}
      </select>
    </label>
  );
}
