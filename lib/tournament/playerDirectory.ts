export type DirectoryPlayer = {
  key: string;
  name: string;
  /** Names of the events this player is entered in, alphabetical. */
  events: string[];
};

type DirectoryEntry = {
  eventName: string;
  players: { userId: string | null; guestName: string | null; user: { name: string } | null }[];
};

export function normalizeForSearch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * One row per person across all events. Registered players are identified by
 * account; walk-ins the organizer typed in have only a name, so those are
 * merged by name (two different walk-ins with the same name would merge too).
 */
export function buildPlayerDirectory(entries: DirectoryEntry[]): DirectoryPlayer[] {
  const byKey = new Map<string, { name: string; events: Set<string> }>();
  for (const entry of entries) {
    for (const player of entry.players) {
      const name = player.user?.name ?? player.guestName ?? "Unknown";
      const key = player.userId ? `user:${player.userId}` : `guest:${normalizeForSearch(name)}`;
      const existing = byKey.get(key) ?? { name, events: new Set<string>() };
      existing.events.add(entry.eventName);
      byKey.set(key, existing);
    }
  }
  return [...byKey.entries()]
    .map(([key, { name, events }]) => ({
      key,
      name,
      events: [...events].sort((a, b) => a.localeCompare(b, "en", { numeric: true })),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }) || a.key.localeCompare(b.key));
}

/** Every whitespace-separated word of the query must appear in the name (accent- and case-insensitive). */
export function playerMatchesQuery(name: string, query: string): boolean {
  const words = normalizeForSearch(query).split(" ").filter(Boolean);
  if (words.length === 0) return true;
  const haystack = normalizeForSearch(name);
  return words.every((word) => haystack.includes(word));
}

/** "A"–"Z" for the name's first letter (accents ignored); anything else is "#". */
export function initialOf(name: string): string {
  const first = normalizeForSearch(name).charAt(0).toUpperCase();
  return /^[A-Z]$/.test(first) ? first : "#";
}

export function groupByInitial<T extends { name: string }>(players: T[]): { letter: string; players: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const player of players) {
    const letter = initialOf(player.name);
    groups.set(letter, [...(groups.get(letter) ?? []), player]);
  }
  return [...groups.entries()]
    .map(([letter, list]) => ({ letter, players: list }))
    .sort((a, b) => (a.letter === "#" ? 1 : b.letter === "#" ? -1 : a.letter.localeCompare(b.letter)));
}
