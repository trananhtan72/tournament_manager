"use client";

import { useCallback, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/Button";
import type { RegulationsDoc } from "@/lib/regulations";

// The editor is only needed when the popup is opened, so keep it (and Tiptap)
// out of the page's initial bundle.
const RegulationsEditor = dynamic(
  () => import("@/app/organizer/[slug]/RegulationsEditor").then((m) => m.RegulationsEditor),
  { ssr: false, loading: () => <p className="text-sm text-slate-500">Loading editor…</p> },
);

export function RegulationsEditorDialog({
  tournamentId,
  initialDoc,
}: {
  tournamentId: string;
  initialDoc: RegulationsDoc | null;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  const close = useCallback(() => dialogRef.current?.close(), []);

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        onClick={() => {
          setOpen(true);
          dialogRef.current?.showModal();
        }}
      >
        {initialDoc ? "Edit regulations" : "Write regulations"}
      </Button>
      <dialog
        ref={dialogRef}
        aria-label="Regulations editor"
        onClose={() => setOpen(false)}
        className="m-auto w-[min(48rem,calc(100vw-2rem))] rounded-lg border border-slate-200 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-black/50 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
      >
        <div className="border-b border-slate-200 px-5 py-3 dark:border-slate-700">
          <h2 className="text-base font-semibold">Tournament regulations</h2>
        </div>
        <div className="px-5 py-4">
          {open && <RegulationsEditor tournamentId={tournamentId} initialDoc={initialDoc} onDone={close} />}
        </div>
      </dialog>
    </>
  );
}
