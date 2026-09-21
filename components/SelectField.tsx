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
    <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
      {label}
      <select
        id={name}
        name={name}
        className={`rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900 outline-none focus:border-slate-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white ${className}`}
        {...props}
      >
        {children}
      </select>
    </label>
  );
}
