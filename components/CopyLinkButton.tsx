"use client";

import { useState } from "react";
import { Button } from "@/components/Button";

/** Copies the full address of `href` (a path on this site) so it can be pasted onto a TV or tablet. */
export function CopyLinkButton({ href, label = "Copy link" }: { href: string; label?: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(new URL(href, window.location.origin).toString());
      setState("copied");
    } catch {
      setState("failed");
    }
    setTimeout(() => setState("idle"), 2000);
  }

  return (
    <Button type="button" variant="secondary" className="px-2 py-1 text-xs" onClick={copy}>
      {state === "copied" ? "Copied" : state === "failed" ? "Copy failed" : label}
    </Button>
  );
}
