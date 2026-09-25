"use client";

import { useActionState } from "react";
import { startLiveMatch, type LiveActionState } from "@/app/actions/live";
import { CourtSelect } from "@/components/CourtSelect";
import { SubmitButton } from "@/components/SubmitButton";
import { FormError } from "@/components/FormError";
import { dateTimeLocalFromDevice } from "@/lib/tournament/schedule";

const initialState: LiveActionState = {};

function StartFields({
  matchId,
  names,
  courtCount,
  defaultCourt,
  intro,
}: {
  matchId: string;
  names: [string, string];
  courtCount: number;
  defaultCourt: number | null;
  intro: string;
}) {
  const [state, formAction] = useActionState(startLiveMatch.bind(null, matchId), initialState);

  return (
    <form
      // The start time is this device's clock (the venue's wall-clock time).
      action={(formData) => {
        formData.set("startedAt", dateTimeLocalFromDevice());
        formAction(formData);
      }}
      className="flex flex-col gap-4"
    >
      <p className="text-sm text-slate-600 dark:text-slate-400">{intro}</p>

      <CourtSelect
        label="Court"
        name="court"
        courtCount={courtCount}
        emptyLabel="Choose a court"
        emptyDisabled
        required
        defaultValue={defaultCourt !== null && defaultCourt <= courtCount ? String(defaultCourt) : ""}
        className="w-48"
      />

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Who serves first? (after the toss)</span>
        <div className="flex flex-col gap-3 sm:flex-row">
          <SubmitButton name="firstServer" value="1" variant="secondary" pendingLabel="Starting…">
            {names[0]} serves first
          </SubmitButton>
          <SubmitButton name="firstServer" value="2" variant="secondary" pendingLabel="Starting…">
            {names[1]} serves first
          </SubmitButton>
        </div>
      </div>
      <FormError message={state.error} />
    </form>
  );
}

/**
 * Starting a live match: pick the court, then who serves first. The first
 * server is the referee's call after the toss, so when a referee has been
 * assigned the organizer's screen leaves it to them (and to their device),
 * keeping a "start it here instead" override for when that isn't practical.
 */
export function StartLiveForm({
  matchId,
  names,
  courtCount,
  defaultCourt,
  viewer,
  refereeName,
}: {
  matchId: string;
  names: [string, string];
  courtCount: number;
  /** The court the match was scheduled on, if it has a court number. */
  defaultCourt: number | null;
  viewer: "organizer" | "referee";
  /** The assigned referee's name, if there is one. */
  refereeName: string | null;
}) {
  const fields = { matchId, names, courtCount, defaultCourt };

  if (viewer === "organizer" && refereeName !== null) {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
        <div>
          <h2 className="text-lg font-semibold">Waiting for {refereeName} to start the match</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            After the toss, {refereeName} picks the court and who serves first on their own phone or tablet, then scores
            the match. It will show as live here and in the Match center once they do.
          </p>
        </div>
        <details className="text-sm">
          <summary className="cursor-pointer text-slate-600 underline dark:text-slate-400">
            Start it here on their behalf instead
          </summary>
          <div className="pt-3">
            <StartFields
              {...fields}
              intro={`Only if ${refereeName} can't. Tell us the court and who they say serves first.`}
            />
          </div>
        </details>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
      <h2 className="text-lg font-semibold">Start live scoring</h2>
      <StartFields
        {...fields}
        intro={
          viewer === "referee"
            ? "You're the referee for this match. After the toss, pick the court and who serves first, then tap a side each time it wins a rally. The court's scoreboard screen and everyone following the tournament see the score update."
            : "No referee is assigned, so you're scoring this one. Pick the court and who serves first (after the toss), then tap a side each time it wins a rally."
        }
      />
    </div>
  );
}
