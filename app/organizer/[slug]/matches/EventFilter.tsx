"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * A tournament with several events can pile up dozens of matches on this
 * page; this narrows both lists down to one event via the URL (?event=id),
 * so the filtered view is a page you can navigate to directly.
 */
export function EventFilter({ events }: { events: { id: string; name: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selected = searchParams.get("event") ?? "";

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = new URLSearchParams(searchParams.toString());
    if (e.target.value) next.set("event", e.target.value);
    else next.delete("event");
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="font-medium text-slate-700 dark:text-slate-300">Event</span>
      <select
        value={selected}
        onChange={onChange}
        className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-slate-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
      >
        <option value="">All</option>
        {events.map((event) => (
          <option key={event.id} value={event.id}>
            {event.name}
          </option>
        ))}
      </select>
    </label>
  );
}
