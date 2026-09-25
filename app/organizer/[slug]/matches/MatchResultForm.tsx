"use client";

import { useActionState, useCallback, useState } from "react";
import { submitMatchResult, type MatchActionState } from "@/app/actions/matches";
import { MatchCard } from "@/components/Bracket";
import { SelectField } from "@/components/SelectField";
import { SubmitButton } from "@/components/SubmitButton";
import { Button } from "@/components/Button";
import { FormError } from "@/components/FormError";
import { gameScoreCap, gamesToWin } from "@/lib/tournament/gameFormat";
import { dateTimeLocalFromDevice } from "@/lib/tournament/schedule";

const initialState: MatchActionState = {};

type ExistingResult = {
  status: "COMPLETED" | "WALKOVER" | "RETIRED" | null;
  winnerId: string | null;
  games: { entry1Score: number; entry2Score: number }[];
  /** When it started, as a datetime-local value, once a result has been saved. */
  startedAt: string | null;
};

export function MatchResultForm({
  matchId,
  entry1Id,
  entry1Label,
  entry2Id,
  entry2Label,
  gamesPerMatch,
  pointsPerGame,
  scheduledAt,
  startedLabel,
  allowEdit = true,
  existing,
}: {
  matchId: string;
  entry1Id: string;
  entry1Label: string;
  entry2Id: string;
  entry2Label: string;
  gamesPerMatch: number;
  pointsPerGame: number;
  /** The scheduled time (datetime-local), used as the default start time. */
  scheduledAt: string | null;
  /** "Started Tue, Dec 1 · 9:07 AM" for a saved result. */
  startedLabel: string | null;
  /** False where a saved result mustn't be editable (a referee can't change one). */
  allowEdit?: boolean;
  existing: ExistingResult;
}) {
  const gameIndexes = Array.from({ length: gamesPerMatch }, (_, i) => i);
  const minGames = gamesToWin({ gamesPerMatch, pointsPerGame });
  const [isOpen, setIsOpen] = useState(existing.status === null);
  const [status, setStatus] = useState<"COMPLETED" | "WALKOVER" | "RETIRED">(existing.status ?? "COMPLETED");
  const [scores, setScores] = useState(() =>
    gameIndexes.map((n) => ({
      entry1: String(existing.games[n]?.entry1Score ?? ""),
      entry2: String(existing.games[n]?.entry2Score ?? ""),
    })),
  );
  const [winnerEntryId, setWinnerEntryId] = useState(existing.winnerId ?? "");
  // Every played match records when it began: what was saved, else when it was
  // scheduled, else right now — filled in on the device when the field appears,
  // since the server doesn't know the venue's time zone.
  const prefillNow = useCallback((input: HTMLInputElement | null) => {
    if (input && input.value === "") input.value = dateTimeLocalFromDevice();
  }, []);

  const action = submitMatchResult.bind(null, matchId);
  const [state, formAction] = useActionState(action, initialState);

  if (!isOpen) {
    const winnerLabel = existing.winnerId === entry1Id ? entry1Label : existing.winnerId === entry2Id ? entry2Label : null;
    return (
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
        <MatchCard
          match={{
            id: matchId,
            round: 0,
            position: 0,
            entry1Label,
            entry1Seed: null,
            entry2Label,
            entry2Seed: null,
            winnerLabel,
            isBye: false,
            status: existing.status,
            games: existing.games,
            gamesPerMatch,
          }}
        />
        {startedLabel && <span className="text-xs text-slate-500">{startedLabel}</span>}
        </div>
        {allowEdit && (
          <Button type="button" variant="secondary" className="shrink-0 px-2 py-1 text-xs" onClick={() => setIsOpen(true)}>
            Edit result
          </Button>
        )}
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-md border border-slate-200 p-3 dark:border-slate-700">
      <p className="text-sm font-medium">
        {entry1Label} vs {entry2Label}
      </p>
      <SelectField
        label="Result type"
        name="status"
        value={status}
        onChange={(e) => setStatus(e.target.value as typeof status)}
      >
        <option value="COMPLETED">Completed</option>
        <option value="WALKOVER">Walkover</option>
        <option value="RETIRED">Retired</option>
      </SelectField>

      {status === "COMPLETED" ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-slate-500">
            {gamesPerMatch === 1 ? "One game" : `Best of ${gamesPerMatch}`} to {pointsPerGame} — win by 2, capped at{" "}
            {gameScoreCap(pointsPerGame)}.
          </p>
          {gameIndexes.map((i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <span className="w-14 shrink-0 text-slate-500">Game {i + 1}</span>
              <input
                type="number"
                min={0}
                aria-label={`Game ${i + 1} ${entry1Label} score`}
                placeholder={entry1Label}
                value={scores[i].entry1}
                onChange={(e) => {
                  const next = [...scores];
                  next[i] = { ...next[i], entry1: e.target.value };
                  setScores(next);
                }}
                name={`game${i + 1}Entry1`}
                className="w-16 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm outline-none focus:border-slate-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
              />
              <span className="text-slate-400">–</span>
              <input
                type="number"
                min={0}
                aria-label={`Game ${i + 1} ${entry2Label} score`}
                placeholder={entry2Label}
                value={scores[i].entry2}
                onChange={(e) => {
                  const next = [...scores];
                  next[i] = { ...next[i], entry2: e.target.value };
                  setScores(next);
                }}
                name={`game${i + 1}Entry2`}
                className="w-16 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm outline-none focus:border-slate-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
              />
              {i >= minGames && <span className="text-xs text-slate-400">(if needed)</span>}
            </div>
          ))}
        </div>
      ) : (
        <SelectField
          label="Winner"
          name="winnerEntryId"
          value={winnerEntryId}
          onChange={(e) => setWinnerEntryId(e.target.value)}
        >
          <option value="" disabled>
            Select winner
          </option>
          <option value={entry1Id}>{entry1Label}</option>
          <option value={entry2Id}>{entry2Label}</option>
        </SelectField>
      )}

      {status !== "WALKOVER" && (
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
          Match started
          <input
            type="datetime-local"
            name="startedAt"
            required
            defaultValue={existing.startedAt ?? scheduledAt ?? ""}
            ref={prefillNow}
            className="w-56 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900 outline-none focus:border-slate-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
          />
          <span className="text-xs font-normal text-slate-500">Venue time. Saved with the result.</span>
        </label>
      )}

      <FormError message={state.error} />

      <div className="flex items-center gap-2">
        <SubmitButton pendingLabel="Saving…">Save result</SubmitButton>
        {existing.status !== null && (
          <Button type="button" variant="secondary" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
