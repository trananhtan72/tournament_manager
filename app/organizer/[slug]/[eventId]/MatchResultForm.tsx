"use client";

import { useActionState, useState } from "react";
import { submitMatchResult, type MatchActionState } from "@/app/actions/matches";
import { SelectField } from "@/components/SelectField";
import { SubmitButton } from "@/components/SubmitButton";
import { Button } from "@/components/Button";
import { FormError } from "@/components/FormError";

const initialState: MatchActionState = {};

type ExistingResult = {
  status: "COMPLETED" | "WALKOVER" | "RETIRED" | null;
  winnerId: string | null;
  games: { entry1Score: number; entry2Score: number }[];
};

function resultSummary(existing: ExistingResult, entry1Id: string, entry1Label: string, entry2Label: string): string {
  if (!existing.status) return "Not yet played";
  const winnerLabel = existing.winnerId === entry1Id ? entry1Label : entry2Label;
  if (existing.status === "WALKOVER") return `Walkover — ${winnerLabel} won`;
  if (existing.status === "RETIRED") return `Retired — ${winnerLabel} won`;
  const scores = existing.games.map((g) => `${g.entry1Score}-${g.entry2Score}`).join(", ");
  return `${winnerLabel} won, ${scores}`;
}

export function MatchResultForm({
  matchId,
  entry1Id,
  entry1Label,
  entry2Id,
  entry2Label,
  existing,
}: {
  matchId: string;
  entry1Id: string;
  entry1Label: string;
  entry2Id: string;
  entry2Label: string;
  existing: ExistingResult;
}) {
  const [isOpen, setIsOpen] = useState(existing.status === null);
  const [status, setStatus] = useState<"COMPLETED" | "WALKOVER" | "RETIRED">(existing.status ?? "COMPLETED");
  const [scores, setScores] = useState(() =>
    [0, 1, 2].map((n) => ({
      entry1: String(existing.games[n]?.entry1Score ?? ""),
      entry2: String(existing.games[n]?.entry2Score ?? ""),
    })),
  );
  const [winnerEntryId, setWinnerEntryId] = useState(existing.winnerId ?? "");

  const action = submitMatchResult.bind(null, matchId);
  const [state, formAction] = useActionState(action, initialState);

  if (!isOpen) {
    return (
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-slate-500">{resultSummary(existing, entry1Id, entry1Label, entry2Label)}</span>
        <Button type="button" variant="secondary" className="px-2 py-1 text-xs" onClick={() => setIsOpen(true)}>
          Edit result
        </Button>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-md border border-slate-200 p-3 dark:border-slate-700">
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
          {[0, 1, 2].map((i) => (
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
              {i === 2 && <span className="text-xs text-slate-400">(only if 1-1)</span>}
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
