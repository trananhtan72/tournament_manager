"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * A small List/Grid-style toggle backed by a `?view=` query param (default:
 * the first option), so the chosen view is a page you can link to directly
 * and other params (like an event filter) survive the switch. Plain links,
 * not a client-side state change — the page itself decides what to render
 * from the URL, same as EventFilter.
 */
export function ViewTabs({
  paramName = "view",
  options,
}: {
  paramName?: string;
  options: { value: string; label: string }[];
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get(paramName) ?? options[0]?.value;

  return (
    <div role="tablist" aria-label="View" className="inline-flex gap-1 rounded-full border border-border p-1">
      {options.map((option) => {
        const active = option.value === current;
        const params = new URLSearchParams(searchParams.toString());
        if (option.value === options[0]?.value) params.delete(paramName);
        else params.set(paramName, option.value);
        const qs = params.toString();
        return (
          <Link
            key={option.value}
            href={qs ? `${pathname}?${qs}` : pathname}
            role="tab"
            aria-selected={active}
            className={`rounded-full px-3 py-1 text-sm font-medium ${
              active ? "bg-primary text-primary-foreground" : "text-muted hover:bg-surface-muted"
            }`}
          >
            {option.label}
          </Link>
        );
      })}
    </div>
  );
}
