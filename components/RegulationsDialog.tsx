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
        className="m-auto w-[min(42rem,calc(100vw-2rem))] rounded-lg border border-border bg-surface p-0 text-text shadow-xl backdrop:bg-black/50"
      >
        <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-3">
          <h2 className="text-base font-semibold">{title}</h2>
          <button
            type="button"
            className="rounded-md px-2 py-1 text-sm text-muted hover:bg-surface-muted"
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
