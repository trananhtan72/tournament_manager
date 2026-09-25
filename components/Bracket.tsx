import { roundName } from "@/lib/tournament/singleElimination";

export type BracketMatchView = {
  id: string;
  round: number;
  position: number;
  entry1Label: string | null;
  entry1Seed: number | null;
  entry2Label: string | null;
  entry2Seed: number | null;
  winnerLabel: string | null;
  isBye: boolean;
  status: "COMPLETED" | "WALKOVER" | "RETIRED" | null;
  games: { entry1Score: number; entry2Score: number }[];
  /** How many game cells to draw per side (the match's best-of-N). */
  gamesPerMatch: number;
};

function entryDisplay(label: string | null, seed: number | null): string | null {
  if (label === null) return null;
  return seed !== null ? `${label} [${seed}]` : label;
}

// Always renders one cell per possible game (the match's best-of-N), blank
// where a game wasn't played, so a side's scores line up in fixed columns
// regardless of how many games the match went to. Whichever side won a given
// game is bolded, independently of who won the match overall.
function ScoreCells({ scores, wonGame }: { scores: (number | null)[]; wonGame: boolean[] }) {
  return (
    <div className="flex shrink-0 gap-1">
      {scores.map((value, i) => (
        <span
          key={i}
          className={`w-4 text-center text-xs tabular-nums ${
            wonGame[i]
              ? "font-semibold text-slate-900 dark:text-white print:text-slate-900"
              : "text-slate-500 dark:text-slate-400 print:text-slate-600"
          }`}
        >
          {value ?? ""}
        </span>
      ))}
    </div>
  );
}

export function MatchCard({ match }: { match: BracketMatchView }) {
  const isEntry1Winner = match.winnerLabel !== null && match.winnerLabel === match.entry1Label;
  const isEntry2Winner = match.winnerLabel !== null && match.winnerLabel === match.entry2Label;
  const hasGames = match.games.length > 0;
  // Never fewer cells than games actually recorded, so nothing is ever hidden.
  const cellCount = Math.max(match.gamesPerMatch, match.games.length);
  const cellIndexes = Array.from({ length: cellCount }, (_, i) => i);
  const entry1Scores = cellIndexes.map((i) => match.games[i]?.entry1Score ?? null);
  const entry2Scores = cellIndexes.map((i) => match.games[i]?.entry2Score ?? null);
  const entry1WonGame = entry1Scores.map((v, i) => {
    const other = entry2Scores[i];
    return v !== null && other !== null && v > other;
  });
  const entry2WonGame = entry2Scores.map((v, i) => {
    const other = entry1Scores[i];
    return v !== null && other !== null && v > other;
  });
  // Walkover/retired always names the side that didn't finish — the loser.
  const statusLabel = match.status === "WALKOVER" ? "Walkover" : match.status === "RETIRED" ? "Retired" : null;
  const entry1StatusLabel = statusLabel && !isEntry1Winner ? statusLabel : null;
  const entry2StatusLabel = statusLabel && !isEntry2Winner ? statusLabel : null;

  return (
    <div className="flex w-64 flex-col gap-1 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 print:border-slate-300 print:bg-white">
      <div className="flex items-center justify-between gap-2">
        <span
          className={`truncate ${isEntry1Winner ? "font-semibold text-slate-900 dark:text-white print:text-slate-900" : "text-slate-600 dark:text-slate-400 print:text-slate-600"}`}
        >
          {entryDisplay(match.entry1Label, match.entry1Seed) ?? "TBD"}
        </span>
        {hasGames && <ScoreCells scores={entry1Scores} wonGame={entry1WonGame} />}
        {entry1StatusLabel && (
          <span className="shrink-0 text-xs text-slate-400 dark:text-slate-500 print:text-slate-500">
            {entry1StatusLabel}
          </span>
        )}
      </div>
      <div className="border-t border-slate-100 dark:border-slate-800 print:border-slate-100" />
      <div className="flex items-center justify-between gap-2">
        <span
          className={`truncate ${isEntry2Winner ? "font-semibold text-slate-900 dark:text-white print:text-slate-900" : "text-slate-600 dark:text-slate-400 print:text-slate-600"}`}
        >
          {match.isBye ? "Bye" : (entryDisplay(match.entry2Label, match.entry2Seed) ?? "TBD")}
        </span>
        {hasGames && !match.isBye && <ScoreCells scores={entry2Scores} wonGame={entry2WonGame} />}
        {entry2StatusLabel && (
          <span className="shrink-0 text-xs text-slate-400 dark:text-slate-500 print:text-slate-500">
            {entry2StatusLabel}
          </span>
        )}
      </div>
    </div>
  );
}

// Every round's column is given this same total height (scaled only by how
// many round-1 matches exist). Because CSS `justify-around` spaces N items
// evenly within a fixed height H, round k's evenly-spaced centers always land
// exactly on the midpoint between the two round-(k-1) centers that feed each
// of its matches — so no per-round layout math is needed to keep the tree
// aligned, only a shared H.
const MATCH_HEIGHT_REM = 4.5;
const ROUND_GAP_REM = 2.5;

/**
 * Wraps a pair of same-round matches with the connector lines that join them
 * into the single next-round match they feed: a vertical line spanning their
 * two centers (drawn at the pair's own 25%/75% marks, which are exactly the
 * two match centers under `justify-around`), plus a horizontal stub reaching
 * across the round gap toward that next match.
 */
function ConnectedPair({ children }: { children: [React.ReactNode, React.ReactNode] }) {
  return (
    <div className="relative flex flex-1 flex-col justify-around">
      <div
        className="pointer-events-none absolute border-r border-slate-300 dark:border-slate-500 print:border-slate-400"
        style={{ right: 0, top: "25%", bottom: "25%" }}
      />
      <div
        className="pointer-events-none absolute top-1/2 border-t border-slate-300 dark:border-slate-500 print:border-slate-400"
        style={{ right: `-${ROUND_GAP_REM}rem`, width: `${ROUND_GAP_REM}rem` }}
      />
      {children[0]}
      {children[1]}
    </div>
  );
}

function RoundColumn({
  matches,
  isLastRound,
  totalHeightRem,
}: {
  matches: BracketMatchView[];
  isLastRound: boolean;
  totalHeightRem: number;
}) {
  if (isLastRound || matches.length === 1) {
    return (
      <div
        className="flex flex-col justify-around"
        style={{ minHeight: `${totalHeightRem}rem` }}
      >
        {matches.map((match) => (
          <MatchCard key={match.id} match={match} />
        ))}
      </div>
    );
  }

  const pairs: [BracketMatchView, BracketMatchView][] = [];
  for (let i = 0; i < matches.length; i += 2) {
    pairs.push([matches[i], matches[i + 1]]);
  }

  return (
    <div className="flex flex-col" style={{ minHeight: `${totalHeightRem}rem` }}>
      {pairs.map((pair) => (
        <ConnectedPair key={pair[0].id}>
          {[<MatchCard key={pair[0].id} match={pair[0]} />, <MatchCard key={pair[1].id} match={pair[1]} />]}
        </ConnectedPair>
      ))}
    </div>
  );
}

export function Bracket({ matches }: { matches: BracketMatchView[] }) {
  const totalRounds = matches.reduce((max, m) => Math.max(max, m.round), 0);
  const rounds = Array.from({ length: totalRounds }, (_, i) => i + 1);
  const round1Count = matches.filter((m) => m.round === 1).length;
  const totalHeightRem = round1Count * MATCH_HEIGHT_REM;

  return (
    <div className="overflow-x-auto print:overflow-visible">
      <div className="flex min-w-max pb-2" style={{ gap: `${ROUND_GAP_REM}rem` }}>
        {rounds.map((round) => {
          const roundMatches = matches
            .filter((m) => m.round === round)
            .sort((a, b) => a.position - b.position);
          return (
            <div key={round} className="flex flex-col gap-4">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 print:text-slate-700">
                {roundName(round, totalRounds)}
              </h3>
              <RoundColumn
                matches={roundMatches}
                isLastRound={round === totalRounds}
                totalHeightRem={totalHeightRem}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
