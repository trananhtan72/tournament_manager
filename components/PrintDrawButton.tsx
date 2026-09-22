"use client";

import { Button } from "@/components/Button";

export function PrintDrawButton() {
  return (
    <Button type="button" variant="secondary" onClick={() => window.print()}>
      Print / Export PDF
    </Button>
  );
}
