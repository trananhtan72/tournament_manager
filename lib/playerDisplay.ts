type EntryPlayerLike = {
  guestName: string | null;
  user: { name: string; email: string } | null;
};

export function playerName(player: EntryPlayerLike): string {
  return player.user?.name ?? player.guestName ?? "Unknown";
}

export function playerEmail(player: EntryPlayerLike): string | null {
  return player.user?.email ?? null;
}

export function entryLabel(entry: { players: EntryPlayerLike[] }): string {
  return entry.players.map((p) => playerName(p)).join(" / ");
}

/** Same as entryLabel, but appends "[N]" for a seeded entry, e.g. "Yasuo [1]". */
export function entryDisplayName(entry: { seed: number | null; players: EntryPlayerLike[] }): string {
  const label = entryLabel(entry);
  return entry.seed !== null ? `${label} [${entry.seed}]` : label;
}

/** "Lee Chong Wei" → "Lee C.W." — the first word kept in full, every word after it collapsed to an initial. A single-word name (or "Unknown") is returned as-is. */
export function shortenPlayerName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return name;
  const [first, ...rest] = parts;
  const initials = rest.map((part) => `${part[0]!.toUpperCase()}.`).join("");
  return `${first} ${initials}`;
}

/**
 * Same as entryDisplayName, but with each player's name shortened (see
 * shortenPlayerName) — for a space-constrained display like the court
 * scoreboard, where "Lee Chong Wei / Wong Bo Han [2]" doesn't fit but
 * "Lee C.W. / Wong B.H. [2]" does.
 */
export function entryScoreboardName(entry: { seed: number | null; players: EntryPlayerLike[] }): string {
  const label = entry.players.map((p) => shortenPlayerName(playerName(p))).join(" / ");
  return entry.seed !== null ? `${label} [${entry.seed}]` : label;
}
