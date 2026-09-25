"use client";

import { useRef, type ReactNode } from "react";

/** A button that opens the regulations (passed as children) in a modal popup. */
export function RegulationsDialog({
  title,
  triggerLabel,
  children,
}: {
  title: string;
  triggerLabel: string;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button type="button" className="text-left underline" onClick={() => dialogRef.current?.showModal()}>
        {triggerLabel}
      </button>
      {/* A native <dialog> gives focus trapping, Escape-to-close and a backdrop.
          Clicks on the backdrop land on the dialog element itself. */}
      <dialog
        ref={dialogRef}
        aria-label={title}
        onClick={(event) => {
          if (event.target === dialogRef.current) dialogRef.current?.close();
        }}
        className="m-auto w-[min(42rem,calc(100vw-2rem))] rounded-lg border border-slate-200 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-black/50 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
      >
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-3 dark:border-slate-700">
          <h2 className="text-base font-semibold">{title}</h2>
          <button
            type="button"
            className="rounded-md px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            onClick={() => dialogRef.current?.close()}
          >
            Close
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
      </dialog>
    </>
  );
}
