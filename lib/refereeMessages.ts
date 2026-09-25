type MatchDescription = {
  /** The two sides, as shown elsewhere ("Ann Alpha", "Bob Bravo / Cat Charlie"). */
  players: [string, string];
  eventName: string;
  stage: string;
  tournamentName: string;
  /** "Tue, Dec 1 · 9:00 AM · Court 3", if the match has a time or court. */
  scheduleLabel: string | null;
};

function describe(m: MatchDescription): string {
  const when = m.scheduleLabel ? ` (${m.scheduleLabel})` : "";
  return `${m.players[0]} vs ${m.players[1]} — ${m.eventName} · ${m.stage} at ${m.tournamentName}${when}`;
}

export const refereeAddedMessage = (tournamentName: string) =>
  `You've been added as a referee for ${tournamentName}. You'll be notified when you're assigned a match.`;

export const refereeRemovedMessage = (tournamentName: string, unassignedCount: number) =>
  unassignedCount > 0
    ? `You've been removed as a referee for ${tournamentName}. Your ${unassignedCount} assigned ${unassignedCount === 1 ? "match was" : "matches were"} unassigned.`
    : `You've been removed as a referee for ${tournamentName}.`;

export const assignedMessage = (m: MatchDescription) =>
  `You've been assigned to officiate ${describe(m)}. After the toss, open it to choose the court and who serves first.`;

export const unassignedMessage = (m: MatchDescription) => `You're no longer assigned to officiate ${describe(m)}.`;
