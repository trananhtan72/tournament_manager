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
      <label className="flex max-w-sm flex-col gap-1 text-sm font-medium text-text">
        Search players
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type a name…"
          autoComplete="off"
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm font-normal text-text outline-none focus:border-primary"
        />
      </label>

      <p className="text-sm text-muted" aria-live="polite">
        {searching
          ? `${visible.length} of ${players.length} ${players.length === 1 ? "player" : "players"}`
          : `${players.length} ${players.length === 1 ? "player" : "players"}`}
      </p>

      {visible.length === 0 ? (
        <p className="text-sm text-muted">No players match &ldquo;{query.trim()}&rdquo;.</p>
      ) : (
        groups.map((group) => (
          <section key={group.letter} className="flex flex-col gap-1">
            <h2 className="border-b border-border pb-1 text-sm font-semibold text-muted">
              {group.letter}
            </h2>
            <ul className="flex flex-col">
              {group.players.map((player) => (
                <li
                  key={player.key}
                  className="flex flex-col gap-0.5 py-1.5 text-sm sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
                >
                  <span className="font-medium">{player.name}</span>
                  <span className="text-muted">{player.events.join(" · ")}</span>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
