"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  changeLiveCourt,
  confirmLiveResult,
  getLivePoints,
  recordPoint,
  resetLiveMatch,
  undoPoint,
  type LivePointsResult,
} from "@/app/actions/live";
import { Button } from "@/components/Button";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { CourtSelect } from "@/components/CourtSelect";
import { gamesToWin, type GameFormat } from "@/lib/tournament/gameFormat";
import { replayPoints, type Side } from "@/lib/tournament/liveScoring";

function GamePips({ won, needed }: { won: number; needed: number }) {
  return (
    <span className="flex gap-1" aria-label={`${won} of ${needed} games won`}>
      {Array.from({ length: needed }, (_, i) => (
        <span
          key={i}
          className={`h-2.5 w-2.5 rounded-full border ${
            i < won ? "border-primary bg-primary" : "border-border"
          }`}
        />
      ))}
    </span>
  );
}

export function LiveScorer({
  matchId,
  names,
  format,
  firstServer,
  initialPoints,
  backHref,
  backLabel,
  manualHref,
  courtNumber,
  courtCount,
  courtDisplayBase,
  startedAt: initialStartedAt,
}: {
  matchId: string;
  names: [string, string];
  format: GameFormat;
  firstServer: Side;
  initialPoints: Side[];
  /** Where "back" goes, and where to go after the result is confirmed. */
  backHref: string;
  backLabel: string;
  /** A page to enter a walkover or retirement on, or null if it's on this one. */
  manualHref: string | null;
  /** The court this match is on, if it's a numbered court. */
  courtNumber: number | null;
  courtCount: number;
  /** Path of the tournament's court screens, e.g. "/t/spring-open/court"; add "/3" for court 3. */
  courtDisplayBase: string;
  /** When scoring began, as a datetime-local value; editable when confirming. */
  startedAt: string;
}) {
  const router = useRouter();
  // The list of rallies is the source of truth. It's updated immediately on a
  // tap (so scoring feels instant even on a slow connection) and the server
  // is told in the background; the server's log replaces it only if the two
  // disagree, e.g. someone else scored the same match.
  const pointsRef = useRef<Side[]>(initialPoints);
  const [points, setPoints] = useState<Side[]>(initialPoints);
  const [error, setError] = useState<string | null>(null);
  // Set when a request failed outright (no answer from the server), so what's
  // on screen may be ahead of what was saved until the score is reloaded.
  const [unsynced, setUnsynced] = useState(false);
  const [startedAt, setStartedAt] = useState(initialStartedAt);
  // Bumped when a court change is refused, so the dropdown goes back to the real court.
  const [courtKey, setCourtKey] = useState(0);
  const [, startTransition] = useTransition();
  const [finishing, startFinishing] = useTransition();

  const state = useMemo(() => replayPoints(points, format, firstServer), [points, format, firstServer]);
  const gamesNeeded = gamesToWin(format);

  function commit(next: Side[]) {
    pointsRef.current = next;
    setPoints(next);
  }

  function apply(next: Side[], send: (expectedPoints: number) => Promise<LivePointsResult>) {
    const expectedPoints = pointsRef.current.length;
    commit(next);
    setError(null);
    startTransition(async () => {
      try {
        const result = await send(expectedPoints);
        if (result.error) {
          setError(result.error);
          commit(result.points);
        }
      } catch {
        setUnsynced(true);
        setError("Couldn't reach the server — your last tap may not have been saved.");
      }
    });
  }

  function reloadScore() {
    startTransition(async () => {
      try {
        const result = await getLivePoints(matchId);
        commit(result.points);
        setUnsynced(false);
        setError(result.error ?? null);
      } catch {
        setError("Still can't reach the server. Check your connection and try again.");
      }
    });
  }

  function awardPoint(side: Side) {
    if (replayPoints(pointsRef.current, format, firstServer).matchWinner) return;
    apply([...pointsRef.current, side], (expected) => recordPoint(matchId, side, expected));
  }

  function undo() {
    if (pointsRef.current.length === 0) return;
    apply(pointsRef.current.slice(0, -1), (expected) => undoPoint(matchId, expected));
  }

  function confirmResult() {
    startFinishing(async () => {
      const result = await confirmLiveResult(matchId, pointsRef.current.length, startedAt);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.push(backHref);
    });
  }

  function changeCourt(nextCourt: number) {
    setError(null);
    startFinishing(async () => {
      const result = await changeLiveCourt(matchId, nextCourt);
      if (result.error) {
        setError(result.error);
        setCourtKey((k) => k + 1);
      } else {
        router.refresh();
      }
    });
  }

  function reset() {
    if (!confirm("Discard the live score for this match and start again?")) return;
    startFinishing(async () => {
      const result = await resetLiveMatch(matchId);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  const current = state.games[state.games.length - 1];
  const scoreOf = (side: Side) => (side === 1 ? current.score1 : current.score2);
  const finishedGames = state.games.filter((g) => g.winner !== null);
  const flag =
    state.matchPoint.length > 0
      ? `Match point — ${state.matchPoint.map((s) => names[s - 1]).join(" and ")}`
      : state.gamePoint.length > 0
        ? `Game point — ${state.gamePoint.map((s) => names[s - 1]).join(" and ")}`
        : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-semibold text-accent">
          <span className="h-2 w-2 animate-pulse rounded-full bg-accent" aria-hidden />
          LIVE · Game {state.currentGame}
        </span>
        {flag && (
          <span role="status" className="rounded-full bg-warning/15 px-3 py-1 text-xs font-medium text-warning">
            {flag}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-x-4 gap-y-2 rounded-md border border-border px-3 py-2">
        <CourtSelect
          key={courtKey}
          label="Court"
          name="courtNumber"
          id="live-court"
          courtCount={courtCount}
          emptyLabel="Choose a court"
          emptyDisabled
          defaultValue={courtNumber !== null && courtNumber <= courtCount ? String(courtNumber) : ""}
          onChange={(e) => changeCourt(Number(e.target.value))}
          className="w-40"
        />
        {courtNumber !== null ? (
          <div className="flex flex-wrap items-center gap-3 pb-1 text-sm">
            <a href={`${courtDisplayBase}/${courtNumber}`} target="_blank" rel="noopener" className="underline">
              Open Court {courtNumber} scoreboard ↗
            </a>
            <CopyLinkButton href={`${courtDisplayBase}/${courtNumber}`} />
          </div>
        ) : (
          <p className="pb-1 text-xs text-muted">Pick a numbered court to get its scoreboard screen link.</p>
        )}
      </div>

      <p className="sr-only" aria-live="polite">
        Game {state.currentGame}: {names[0]} {current.score1}, {names[1]} {current.score2}.
        {state.matchWinner ? ` ${names[state.matchWinner - 1]} wins the match.` : ""}
      </p>

      <div className="grid grid-cols-2 gap-3">
        {([1, 2] as const).map((side) => (
          <button
            key={side}
            type="button"
            onClick={() => awardPoint(side)}
            disabled={state.matchWinner !== null}
            aria-label={`Point for ${names[side - 1]}`}
            className={`flex min-h-44 flex-col items-center justify-between gap-2 rounded-xl border-2 px-3 py-4 text-center transition-colors active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70 ${
              state.server === side
                ? "border-success bg-success/10"
                : "border-border bg-surface hover:bg-surface-muted"
            }`}
          >
            <span className="flex w-full items-center justify-center gap-2 px-1 text-lg font-semibold sm:text-xl">
              <span>{names[side - 1]}</span>
            </span>
            <span className="text-8xl font-bold leading-none tabular-nums" data-testid={`score-${side}`}>
              {scoreOf(side)}
            </span>
            <span className="flex flex-col items-center gap-1 text-xs text-muted">
              <GamePips won={state.gamesWon[side - 1]} needed={gamesNeeded} />
              {state.server === side ? <span className="font-medium text-success">Serving</span> : <span>&nbsp;</span>}
            </span>
          </button>
        ))}
      </div>

      {finishedGames.length > 0 && (
        <p className="text-sm text-muted">
          Games: {finishedGames.map((g) => `${g.score1}–${g.score2}`).join(", ")}
        </p>
      )}

      {state.matchWinner ? (
        <div className="flex flex-col gap-3 rounded-lg border border-success/30 bg-success/10 p-4">
          <p className="font-semibold">
            {names[state.matchWinner - 1]} wins {Math.max(...state.gamesWon)}–{Math.min(...state.gamesWon)}
          </p>
          <p className="text-sm text-muted">
            {finishedGames.map((g) => `${g.score1}–${g.score2}`).join(", ")}. Confirm to record this as the result
            and move the winner on, or undo the last point if it was a mis-tap.
          </p>
          <label className="flex max-w-xs flex-col gap-1 text-sm font-medium">
            Match started
            <input
              type="datetime-local"
              value={startedAt}
              onChange={(e) => setStartedAt(e.target.value)}
              required
              className="rounded-md border border-border bg-surface px-3 py-2 text-sm font-normal text-text outline-none focus:border-primary"
            />
            <span className="text-xs font-normal text-muted">Saved with the result. Correct it if this device&apos;s clock was off.</span>
          </label>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={confirmResult} disabled={finishing}>
              {finishing ? "Saving…" : "Confirm & save result"}
            </Button>
            <Button type="button" variant="secondary" onClick={undo} disabled={finishing}>
              Undo last point
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="secondary" onClick={undo} disabled={points.length === 0}>
            Undo last point
          </Button>
          <span className="text-xs text-muted">{points.length} {points.length === 1 ? "rally" : "rallies"} played</span>
        </div>
      )}

      {error && (
        <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-error">
          <span>{error}</span>
          {unsynced && (
            <Button type="button" variant="secondary" onClick={reloadScore}>
              Reload score
            </Button>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4 border-t border-border pt-4 text-sm">
        <Link href={backHref} className="underline">
          ← Back to {backLabel}
        </Link>
        <button type="button" onClick={reset} disabled={finishing} className="text-error underline disabled:opacity-50">
          Discard live score
        </button>
        {manualHref && (
          <Link href={manualHref} className="text-muted underline">
            Walkover or retirement? Enter the result there
          </Link>
        )}
      </div>
    </div>
  );
}
