"use client";

import { Button } from "@/components/Button";

/**
 * Prints just the element with `targetId` (a draw's bracket), even when the
 * page shows several draws: the print styles only reveal whichever element is
 * marked `data-printing` while the print dialog is open.
 */
export function PrintDrawButton({ targetId }: { targetId: string }) {
  return (
    <Button
      type="button"
      variant="secondary"
      onClick={() => {
        const target = document.getElementById(targetId);
        if (!target) {
          window.print();
          return;
        }
        target.setAttribute("data-printing", "true");
        window.addEventListener("afterprint", () => target.removeAttribute("data-printing"), { once: true });
        window.print();
      }}
    >
      Print / Export PDF
    </Button>
  );
}
