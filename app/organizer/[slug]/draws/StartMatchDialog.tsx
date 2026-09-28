"use client";

import { useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/Button";
import { MatchResultForm } from "@/app/organizer/[slug]/matches/MatchResultForm";
import type { toScorable } from "@/lib/matchView";

/**
 * Wraps a startable match card (children) so clicking it opens a popup with
 * the same choice the Match center offers — score it live, or enter a
 * finished result directly — without leaving the draw. Once a result is
 * saved, the match is no longer "startable" from the caller's point of view,
 * so the next render replaces this wrapper with a plain MatchCard, which
 * closes the dialog along with it.
 */
export function StartMatchDialog({
  liveHref,
  scorable,
  children,
}: {
  liveHref: string;
  scorable: ReturnType<typeof toScorable>;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<"choose" | "manual">("choose");

  const close = () => dialogRef.current?.close();

  return (
    <>
      <button
        type="button"
        className="block cursor-pointer text-left"
        onClick={() => {
          setMode("choose");
          dialogRef.current?.showModal();
        }}
      >
        {children}
      </button>
      <dialog
        ref={dialogRef}
        aria-label="Start match"
        onClick={(event) => {
          if (event.target === dialogRef.current) close();
        }}
        onClose={() => setMode("choose")}
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-lg border border-border bg-surface p-0 text-text shadow-xl backdrop:bg-black/50"
      >
        <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-3">
          <h2 className="text-base font-semibold">Start match</h2>
          <button
            type="button"
            className="rounded-md px-2 py-1 text-sm text-muted hover:bg-surface-muted"
            onClick={close}
          >
            Close
          </button>
        </div>
        <div className="px-5 py-4">
          {mode === "choose" ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm font-medium">
                {scorable.entry1Label} vs {scorable.entry2Label}
              </p>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={liveHref}
                  className="inline-flex items-center justify-center rounded-md border border-border px-4 py-2 text-sm font-medium text-text hover:bg-surface-muted"
                >
                  Live match score
                </Link>
                <Button type="button" variant="secondary" onClick={() => setMode("manual")}>
                  Enter manually
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <MatchResultForm key={scorable.matchId} {...scorable} />
              <Button type="button" variant="secondary" onClick={() => setMode("choose")}>
                ← Back
              </Button>
            </div>
          )}
        </div>
      </dialog>
    </>
  );
}
