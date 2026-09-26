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
          <tr className="border-b border-border text-left text-muted">
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
                className={`border-b border-border last:border-b-0 ${advancing ? "bg-success/10" : ""}`}
              >
                <td className="py-2 pr-2 text-muted">{row.rank}</td>
                <td className="py-2 pr-2 font-medium text-text">{row.label}</td>
                <td className="py-2 pr-2 text-right text-muted">{row.played}</td>
                <td className="py-2 pr-2 text-right text-muted">
                  {row.wins}-{row.losses}
                </td>
                <td className="py-2 pr-2 text-right text-muted">
                  {row.gamesWon - row.gamesLost >= 0 ? "+" : ""}
                  {row.gamesWon - row.gamesLost}
                </td>
                <td className="py-2 text-right text-muted">
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
