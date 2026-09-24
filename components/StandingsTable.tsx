export type StandingsRowView = {
  entryId: string;
  label: string;
  rank: number;
  played: number;
  wins: number;
  losses: number;
  gamesWon: number;
  gamesLost: number;
  pointsWon: number;
  pointsLost: number;
};

export function StandingsTable({
  rows,
  highlightTopN,
}: {
  rows: StandingsRowView[];
  /** Highlights the top N rows, e.g. to show who's advancing from a pool. */
  highlightTopN?: number;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[28rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500 dark:border-slate-700">
            <th className="py-2 pr-2 font-medium">#</th>
            <th className="py-2 pr-2 font-medium">Entry</th>
            <th className="py-2 pr-2 text-right font-medium">P</th>
            <th className="py-2 pr-2 text-right font-medium">W-L</th>
            <th className="py-2 pr-2 text-right font-medium">Game diff</th>
            <th className="py-2 text-right font-medium">Point diff</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const advancing = highlightTopN !== undefined && row.rank <= highlightTopN;
            return (
              <tr
                key={row.entryId}
                className={`border-b border-slate-100 last:border-b-0 dark:border-slate-800 ${
                  advancing ? "bg-emerald-50 dark:bg-emerald-950/40" : ""
                }`}
              >
                <td className="py-2 pr-2 text-slate-500">{row.rank}</td>
                <td className="py-2 pr-2 font-medium text-slate-900 dark:text-white">{row.label}</td>
                <td className="py-2 pr-2 text-right text-slate-600 dark:text-slate-400">{row.played}</td>
                <td className="py-2 pr-2 text-right text-slate-600 dark:text-slate-400">
                  {row.wins}-{row.losses}
                </td>
                <td className="py-2 pr-2 text-right text-slate-600 dark:text-slate-400">
                  {row.gamesWon - row.gamesLost >= 0 ? "+" : ""}
                  {row.gamesWon - row.gamesLost}
                </td>
                <td className="py-2 text-right text-slate-600 dark:text-slate-400">
                  {row.pointsWon - row.pointsLost >= 0 ? "+" : ""}
                  {row.pointsWon - row.pointsLost}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
