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
