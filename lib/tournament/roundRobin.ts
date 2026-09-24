export const MIN_ROUND_ROBIN_ENTRIES = 3;

export type RoundRobinMatch = {
  position: number;
  entry1Id: string;
  entry2Id: string;
};

/** Every entry plays every other entry exactly once. */
export function generateRoundRobinMatches(entryIds: string[]): RoundRobinMatch[] {
  const matches: RoundRobinMatch[] = [];
  let position = 0;
  for (let i = 0; i < entryIds.length; i++) {
    for (let j = i + 1; j < entryIds.length; j++) {
      matches.push({ position: position++, entry1Id: entryIds[i], entry2Id: entryIds[j] });
    }
  }
  return matches;
}

export type StandingsMatchInput = {
  entry1Id: string;
  entry2Id: string;
  winnerId: string | null;
  games: { entry1Score: number; entry2Score: number }[];
};

export type StandingRow = {
  entryId: string;
  rank: number;
  played: number;
  wins: number;
  losses: number;
  gamesWon: number;
  gamesLost: number;
  pointsWon: number;
  pointsLost: number;
};

/**
 * Standings ranked by: match wins, then (for an exact 2-way tie only)
 * head-to-head result, then game difference, then point difference. A 3+way
 * tie skips head-to-head (not well-defined beyond two entries) and falls
 * straight to game/point difference.
 */
export function computeRoundRobinStandings(
  entryIds: string[],
  matches: StandingsMatchInput[],
): StandingRow[] {
  type Stats = {
    played: number;
    wins: number;
    losses: number;
    gamesWon: number;
    gamesLost: number;
    pointsWon: number;
    pointsLost: number;
  };
  const stats = new Map<string, Stats>(
    entryIds.map((id) => [id, { played: 0, wins: 0, losses: 0, gamesWon: 0, gamesLost: 0, pointsWon: 0, pointsLost: 0 }]),
  );

  for (const m of matches) {
    if (m.winnerId === null) continue;
    const s1 = stats.get(m.entry1Id);
    const s2 = stats.get(m.entry2Id);
    if (!s1 || !s2) continue;

    s1.played++;
    s2.played++;
    if (m.winnerId === m.entry1Id) {
      s1.wins++;
      s2.losses++;
    } else {
      s2.wins++;
      s1.losses++;
    }
    for (const g of m.games) {
      s1.pointsWon += g.entry1Score;
      s1.pointsLost += g.entry2Score;
      s2.pointsWon += g.entry2Score;
      s2.pointsLost += g.entry1Score;
      if (g.entry1Score > g.entry2Score) {
        s1.gamesWon++;
        s2.gamesLost++;
      } else {
        s2.gamesWon++;
        s1.gamesLost++;
      }
    }
  }

  function headToHeadWinner(a: string, b: string): string | null {
    const m = matches.find(
      (m) => (m.entry1Id === a && m.entry2Id === b) || (m.entry1Id === b && m.entry2Id === a),
    );
    return m?.winnerId ?? null;
  }

  const rows = entryIds.map((id) => {
    const s = stats.get(id)!;
    return { entryId: id, rank: 0, ...s };
  });
  rows.sort((a, b) => b.wins - a.wins);

  const finalOrder: typeof rows = [];
  let i = 0;
  while (i < rows.length) {
    let j = i;
    while (j < rows.length && rows[j].wins === rows[i].wins) j++;
    const group = rows.slice(i, j);

    if (group.length === 2) {
      const [a, b] = group;
      const h2h = headToHeadWinner(a.entryId, b.entryId);
      if (h2h === a.entryId) {
        finalOrder.push(a, b);
        i = j;
        continue;
      }
      if (h2h === b.entryId) {
        finalOrder.push(b, a);
        i = j;
        continue;
      }
    }

    group.sort((a, b) => {
      const gameDiffA = a.gamesWon - a.gamesLost;
      const gameDiffB = b.gamesWon - b.gamesLost;
      if (gameDiffB !== gameDiffA) return gameDiffB - gameDiffA;
      const pointDiffA = a.pointsWon - a.pointsLost;
      const pointDiffB = b.pointsWon - b.pointsLost;
      return pointDiffB - pointDiffA;
    });
    finalOrder.push(...group);
    i = j;
  }

  finalOrder.forEach((row, idx) => {
    row.rank = idx + 1;
  });
  return finalOrder;
}
