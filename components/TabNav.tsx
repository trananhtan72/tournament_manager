"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type Tab = {
  label: string;
  href: string;
  /** Only active on exactly this path (for a section's root page). */
  exact?: boolean;
  /** Other path prefixes that should also light this tab up. */
  alsoActiveFor?: string[];
  /** A count shown next to the label when above zero (e.g. items needing attention). */
  badge?: number;
};

function isActive(tab: Tab, pathname: string): boolean {
  if (pathname === tab.href) return true;
  if (tab.exact) return false;
  return pathname.startsWith(`${tab.href}/`) || (tab.alsoActiveFor ?? []).some((p) => pathname.startsWith(p));
}

/**
 * Link-based tabs: each tab is its own page, so the address bar, back button
 * and reloads all work. "underline" is the primary bar; "pills" is for a
 * secondary row (e.g. one tab per event) beneath it.
 */
export function TabNav({
  ariaLabel,
  tabs,
  variant = "underline",
}: {
  ariaLabel: string;
  tabs: Tab[];
  variant?: "underline" | "pills";
}) {
  const pathname = usePathname();

  return (
    <nav
      aria-label={ariaLabel}
      className={
        variant === "underline"
          ? "-mx-4 overflow-x-auto border-b border-border px-4"
          : "-mx-4 overflow-x-auto px-4"
      }
    >
      <ul className={`flex min-w-max ${variant === "underline" ? "gap-1" : "gap-2 pb-1"}`}>
        {tabs.map((tab) => {
          const active = isActive(tab, pathname);
          const className =
            variant === "underline"
              ? `-mb-px flex items-center gap-1.5 border-b-2 px-2 py-2 text-sm font-medium sm:px-3 ${
                  active
                    ? "border-primary text-primary"
                    : "border-transparent text-muted hover:border-border hover:text-text"
                }`
              : `flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm ${
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-text hover:bg-surface-muted"
                }`;
          return (
            <li key={tab.href}>
              <Link href={tab.href} aria-current={active ? "page" : undefined} className={className}>
                {tab.label}
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="rounded-full bg-warning/15 px-1.5 text-xs font-medium text-warning">
                    {tab.badge}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
