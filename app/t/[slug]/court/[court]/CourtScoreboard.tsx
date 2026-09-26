// A court's scoreboard, sized in viewport units (vh/vw) so it fills a TV or an
// iPad in either orientation and stays readable from across the court.
//
// One row per player: the name, then a column per game — the winner of each
// finished game in bold, the loser in regular — and finally the game in
// progress in a light weight, with the score of whoever just won the rally
// (and so is serving) enclosed in a green square:
//
//   Player 1   21   19   [ 7 ]
//   Player 2   19   21     4

export type Board = {
  mode: "live" | "final";
  names: [string, string];
  /** Every game so far; while live, the last is the one in progress. */
  games: { score1: number; score2: number }[];
  /** Index of the game in progress (live only). */
  currentIndex: number | null;
  serving: 1 | 2 | null;
  /** "Game point — Ann" / "Match point — Ann", if either applies. */
  flag: string | null;
  winnerSide: 1 | 2 | null;
  /** "Walkover" / "Retired" for results that weren't played out. */
  note: string | null;
};

const small = "[font-size:min(3vh,2.2vw)]";
// Names and scores are what an audience reads from across the court, so they
// get most of the available row height — bigger than the header/footer text.
const nameSize = "[font-size:min(12vh,7.4vw)]";
const numeral = "[font-size:min(24vh,15vw)]";

export function CourtScoreboard({
  board,
  courtNumber,
  tournamentName,
  eventLine,
}: {
  board: Board;
  courtNumber: number;
  tournamentName: string;
  eventLine: string;
}) {
  const live = board.mode === "live";
  const currentIndex = live ? board.currentIndex : null;
  const finished = board.games.filter((_, i) => i !== currentIndex);
  const current = currentIndex !== null ? board.games[currentIndex] : null;
  const columns = finished.length + (current ? 1 : 0);

  // One grid for both players, so each game's scores line up in a column.
  const cells = ([1, 2] as const).map((side) => {
    const name = board.names[side - 1];
    const isWinner = board.winnerSide === side;
    return {
      side,
      name,
      isWinner,
      finished: finished.map((game) => {
        const mine = side === 1 ? game.score1 : game.score2;
        const theirs = side === 1 ? game.score2 : game.score1;
        return { mine, won: mine > theirs };
      }),
      current: current ? (side === 1 ? current.score1 : current.score2) : null,
      serving: live && board.serving === side,
    };
  });

  const gameLabel = currentIndex !== null ? `Game ${currentIndex + 1}` : null;

  return (
    <div className="flex h-full w-full flex-col gap-[2vh] p-[2vmin]">
      <header className={`flex items-center justify-between gap-[2vmin] text-white/70 ${small}`}>
        <span className="truncate">{tournamentName}</span>
        <span className="shrink-0 rounded-md bg-white px-[1.6vmin] py-[0.4vh] font-bold text-black">Court {courtNumber}</span>
        <span className="truncate text-right">{eventLine}</span>
      </header>

      <main
        className="relative grid min-h-0 flex-1 grid-rows-2 overflow-hidden rounded-[2vmin] bg-zinc-900"
        style={{ gridTemplateColumns: `minmax(0,1fr) repeat(${Math.max(columns, 1)}, auto)`, columnGap: "4vmin", paddingInline: "3vmin" }}
      >
        {cells.map((row) => (
          <div key={row.side} className="contents">
            <div
              className={`flex min-w-0 items-center gap-[2vmin]`}
              data-testid={`court-name-${row.side}`}
            >
              <h2
                className={`truncate font-semibold leading-tight ${nameSize} ${row.isWinner ? "text-amber-300" : ""}`}
              >
                {row.name}
              </h2>
              {row.isWinner && (
                <span className="shrink-0 rounded-full bg-amber-400 px-[1.6vmin] py-[0.4vh] font-bold uppercase tracking-wider text-black [font-size:min(2.6vh,1.9vw)]">
                  Winner
                </span>
              )}
            </div>

            {row.finished.map((game, i) => (
              <div
                key={i}
                data-testid={`court-game-${row.side}-${i + 1}`}
                className={`flex min-w-[2ch] items-center justify-end tabular-nums leading-none ${numeral} ${
                  game.won ? "font-extrabold text-white" : "font-normal text-white/55"
                }`}
              >
                {game.mine}
              </div>
            ))}

            {row.current !== null && (
              <div className={`flex items-center justify-end leading-none text-white ${numeral}`}>
                {/* Everyone's current score gets a box this size, so the columns don't move when the serve
                    changes; only the server's is drawn (a green square, sized to the numerals: 1em). */}
                <span
                  data-serving={row.serving ? "true" : "false"}
                  className={`flex h-[1.25em] min-w-[1.25em] items-center justify-center rounded-[0.1em] border-[0.055em] px-[0.1em] tabular-nums ${
                    row.serving ? "border-emerald-400 bg-emerald-400/10" : "border-transparent"
                  }`}
                >
                  <span
                    className="font-light"
                    data-testid={`court-score-${row.side}`}
                    aria-label={row.serving ? `${row.current}, serving` : undefined}
                  >
                    {row.current}
                  </span>
                </span>
              </div>
            )}
          </div>
        ))}
        <div className="pointer-events-none absolute inset-x-[3vmin] top-1/2 border-t border-white/10" />
      </main>

      <footer className={`flex items-center justify-center gap-[3vmin] font-semibold ${small}`}>
        {live ? (
          <>
            <span className="flex items-center gap-[1.2vmin] text-red-400">
              <span className="inline-block animate-pulse rounded-full bg-red-500" style={{ width: "min(2.4vh,1.8vw)", height: "min(2.4vh,1.8vw)" }} />
              LIVE
            </span>
            {gameLabel && <span>{gameLabel}</span>}
            {board.flag && <span className="rounded-full bg-amber-400 px-[2vmin] py-[0.4vh] text-black">{board.flag}</span>}
          </>
        ) : (
          <>
            <span className="text-amber-400">FINAL</span>
            {board.note && <span>{board.note}</span>}
          </>
        )}
      </footer>
    </div>
  );
}

/** Nothing on court right now: the next match, or a plain waiting screen. */
export function CourtWaiting({
  courtNumber,
  tournamentName,
  next,
}: {
  courtNumber: number;
  tournamentName: string;
  next: { names: [string, string]; eventLine: string; when: string } | null;
}) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-[4vh] p-[4vmin] text-center">
      <p className={`text-white/60 ${small}`}>{tournamentName}</p>
      <h1 className="font-bold leading-none [font-size:min(24vh,16vw)]">Court {courtNumber}</h1>
      {next ? (
        <div className="flex flex-col items-center gap-[1.5vh]">
          <p className="uppercase tracking-widest text-white/50 [font-size:min(3.2vh,2.4vw)]">Up next · {next.when}</p>
          <p className="font-semibold [font-size:min(6.5vh,4.6vw)]">
            {next.names[0]} <span className="text-white/40">vs</span> {next.names[1]}
          </p>
          <p className="text-white/60 [font-size:min(3.6vh,2.6vw)]">{next.eventLine}</p>
        </div>
      ) : (
        <p className="text-white/50 [font-size:min(4vh,3vw)]">No match scheduled on this court</p>
      )}
    </div>
  );
}
