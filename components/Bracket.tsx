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
};

function entryDisplay(label: string | null, seed: number | null): string | null {
  if (label === null) return null;
  return seed !== null ? `${label} [${seed}]` : label;
}

function MatchCard({ match }: { match: BracketMatchView }) {
  const isEntry1Winner = match.winnerLabel !== null && match.winnerLabel === match.entry1Label;
  const isEntry2Winner = match.winnerLabel !== null && match.winnerLabel === match.entry2Label;

  return (
    <div className="flex w-56 flex-col gap-1 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 print:border-slate-300 print:bg-white">
      <div
        className={`truncate ${isEntry1Winner ? "font-semibold text-slate-900 dark:text-white print:text-slate-900" : "text-slate-600 dark:text-slate-400 print:text-slate-600"}`}
      >
        {entryDisplay(match.entry1Label, match.entry1Seed) ?? "TBD"}
      </div>
      <div className="border-t border-slate-100 dark:border-slate-800 print:border-slate-100" />
      <div
        className={`truncate ${isEntry2Winner ? "font-semibold text-slate-900 dark:text-white print:text-slate-900" : "text-slate-600 dark:text-slate-400 print:text-slate-600"}`}
      >
        {match.isBye ? "Bye" : (entryDisplay(match.entry2Label, match.entry2Seed) ?? "TBD")}
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
