import { type ComponentProps } from "react";

type TextFieldProps = ComponentProps<"input"> & {
  label: string;
  name: string;
};

export function TextField({ label, name, className = "", ...props }: TextFieldProps) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
      {label}
      <input
        id={name}
        name={name}
        className={`rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900 outline-none focus:border-slate-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white ${className}`}
        {...props}
      />
    </label>
  );
}
