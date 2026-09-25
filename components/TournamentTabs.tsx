"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { label: "Overview", path: "" },
  { label: "Events", path: "/events" },
  { label: "Draws", path: "/draws" },
  { label: "Matches", path: "/matches" },
  { label: "Players", path: "/players" },
];

export function TournamentTabs({ slug }: { slug: string }) {
  const pathname = usePathname();
  const base = `/t/${slug}`;

  return (
    <nav aria-label="Tournament sections" className="-mx-4 overflow-x-auto border-b border-slate-200 px-4 dark:border-slate-800">
      <ul className="flex min-w-max gap-1">
        {TABS.map((tab) => {
          const href = `${base}${tab.path}`;
          const active = tab.path === "" ? pathname === base : pathname.startsWith(href);
          return (
            <li key={tab.label}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`-mb-px block border-b-2 px-2 py-2 text-sm font-medium sm:px-3 ${
                  active
                    ? "border-slate-900 text-slate-900 dark:border-white dark:text-white"
                    : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-white"
                }`}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
