"use client";

import { useMemo, useState } from "react";
import {
  groupByInitial,
  playerMatchesQuery,
  type DirectoryPlayer,
} from "@/lib/tournament/playerDirectory";

export function PlayersList({ players }: { players: DirectoryPlayer[] }) {
  const [query, setQuery] = useState("");

  const visible = useMemo(() => players.filter((p) => playerMatchesQuery(p.name, query)), [players, query]);
  const groups = useMemo(() => groupByInitial(visible), [visible]);
  const searching = query.trim() !== "";

  return (
    <div className="flex flex-col gap-4">
      <label className="flex max-w-sm flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
        Search players
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type a name…"
          autoComplete="off"
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900 outline-none focus:border-slate-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
        />
      </label>

      <p className="text-sm text-slate-500" aria-live="polite">
        {searching
          ? `${visible.length} of ${players.length} ${players.length === 1 ? "player" : "players"}`
          : `${players.length} ${players.length === 1 ? "player" : "players"}`}
      </p>

      {visible.length === 0 ? (
        <p className="text-sm text-slate-500">No players match &ldquo;{query.trim()}&rdquo;.</p>
      ) : (
        groups.map((group) => (
          <section key={group.letter} className="flex flex-col gap-1">
            <h2 className="border-b border-slate-200 pb-1 text-sm font-semibold text-slate-500 dark:border-slate-800">
              {group.letter}
            </h2>
            <ul className="flex flex-col">
              {group.players.map((player) => (
                <li
                  key={player.key}
                  className="flex flex-col gap-0.5 py-1.5 text-sm sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
                >
                  <span className="font-medium">{player.name}</span>
                  <span className="text-slate-600 dark:text-slate-400">{player.events.join(" · ")}</span>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
