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
