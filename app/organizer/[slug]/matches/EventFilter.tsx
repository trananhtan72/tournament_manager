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
      <span className="font-medium text-text">Event</span>
      <select
        value={selected}
        onChange={onChange}
        className="rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-text outline-none focus:border-primary"
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
