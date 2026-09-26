"use client";

import { useEffect, useRef, useState } from "react";
import type { DrawFormat } from "@prisma/client";
import { SelectField } from "@/components/SelectField";
import { TextField } from "@/components/TextField";
import { drawFormatLabels } from "@/lib/eventLabels";
import {
  ALLOWED_GAMES_PER_MATCH,
  CUSTOM_GAME_FORMAT_KEY,
  DEFAULT_GAME_FORMAT,
  GAME_FORMAT_PRESETS,
  MAX_POINTS_PER_GAME,
  MIN_POINTS_PER_GAME,
  gameScoreCap,
  presetKeyFor,
  type GameFormat,
} from "@/lib/tournament/gameFormat";

/**
 * React resets the enclosing <form> after every action, and a native reset
 * snaps a controlled <select> back to its first option without firing
 * onChange — leaving what's shown out of step with the state that feeds the
 * hidden inputs. Bumping this key on each reset remounts the selects so they
 * pick their value back up from state.
 */
function useFormResetKey() {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [resetKey, setResetKey] = useState(0);

  useEffect(() => {
    const form = anchorRef.current?.closest("form");
    if (!form) return;
    const onReset = () => setResetKey((k) => k + 1);
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, []);

  return { anchorRef, resetKey };
}

function GameFormatPicker({
  label,
  fieldPrefix,
  initial,
  selectKey,
}: {
  label: string;
  /** "" for the event's main format, "knockout" for the knockout stage's. */
  fieldPrefix: "" | "knockout";
  initial: GameFormat;
  selectKey: number;
}) {
  const [presetKey, setPresetKey] = useState(() => presetKeyFor(initial));
  const [customGames, setCustomGames] = useState(String(initial.gamesPerMatch));
  const [customPoints, setCustomPoints] = useState(String(initial.pointsPerGame));

  const isCustom = presetKey === CUSTOM_GAME_FORMAT_KEY;
  const preset = GAME_FORMAT_PRESETS.find((p) => p.key === presetKey);
  const games = isCustom ? customGames : String((preset?.format ?? DEFAULT_GAME_FORMAT).gamesPerMatch);
  const points = isCustom ? customPoints : String((preset?.format ?? DEFAULT_GAME_FORMAT).pointsPerGame);

  // Field names are prefixed for the knockout stage: "gamesPerMatch" vs
  // "knockoutGamesPerMatch", etc.
  const name = (base: string) => (fieldPrefix ? `${fieldPrefix}${base[0].toUpperCase()}${base.slice(1)}` : base);
  const pointsNumber = Number(customPoints);

  return (
    <>
      <SelectField
        key={`${name("gameFormatPreset")}-${selectKey}`}
        label={label}
        name={name("gameFormatPreset")}
        value={presetKey}
        onChange={(e) => {
          const next = e.target.value;
          // Leaving a preset for Custom starts the custom fields from that
          // preset's numbers, so it's a tweak rather than a blank slate.
          if (next === CUSTOM_GAME_FORMAT_KEY && preset) {
            setCustomGames(String(preset.format.gamesPerMatch));
            setCustomPoints(String(preset.format.pointsPerGame));
          }
          setPresetKey(next);
        }}
      >
        {GAME_FORMAT_PRESETS.map((p) => (
          <option key={p.key} value={p.key}>
            {p.label}
          </option>
        ))}
        <option value={CUSTOM_GAME_FORMAT_KEY}>Custom…</option>
      </SelectField>
      {isCustom && (
        <>
          <SelectField
            key={`${name("customGamesPerMatch")}-${selectKey}`}
            label="Games per match"
            name={name("customGamesPerMatch")}
            value={customGames}
            onChange={(e) => setCustomGames(e.target.value)}
          >
            {ALLOWED_GAMES_PER_MATCH.map((n) => (
              <option key={n} value={String(n)}>
                {n === 1 ? "1 game" : `Best of ${n}`}
              </option>
            ))}
          </SelectField>
          <div className="flex flex-col gap-1">
            <TextField
              label="Points per game"
              name={name("customPointsPerGame")}
              type="number"
              inputMode="numeric"
              required
              min={MIN_POINTS_PER_GAME}
              max={MAX_POINTS_PER_GAME}
              step={1}
              className="w-32"
              value={customPoints}
              onChange={(e) => setCustomPoints(e.target.value)}
            />
            {Number.isInteger(pointsNumber) && pointsNumber >= MIN_POINTS_PER_GAME && (
              <span className="text-xs text-muted">
                Win by 2, capped at {gameScoreCap(pointsNumber)}
              </span>
            )}
          </div>
        </>
      )}
      {/* The submitted values: resolved from the preset or the custom fields.
          Chromium injects caret-color:transparent on hidden inputs after
          hydration, which React flags as a mismatch it won't patch up —
          harmless, so it's suppressed. */}
      <input type="hidden" name={name("gamesPerMatch")} value={games} suppressHydrationWarning />
      <input type="hidden" name={name("pointsPerGame")} value={points} suppressHydrationWarning />
    </>
  );
}

/**
 * Draw format plus game format, together because they depend on each other:
 * pools+knockout gets a separate game format for each of its two stages.
 * Renders as a fragment so it can sit in the parent form's flex row.
 */
export function EventFormatFields({
  initialDrawFormat = "SINGLE_ELIMINATION",
  initialGameFormat = DEFAULT_GAME_FORMAT,
  initialKnockoutGameFormat = null,
}: {
  initialDrawFormat?: DrawFormat;
  initialGameFormat?: GameFormat;
  /** Null means the knockout stage uses the same format as the pool stage. */
  initialKnockoutGameFormat?: GameFormat | null;
}) {
  const [drawFormat, setDrawFormat] = useState<DrawFormat>(initialDrawFormat);
  const { anchorRef, resetKey } = useFormResetKey();
  const isPools = drawFormat === "POOLS_KNOCKOUT";

  return (
    <>
      <span ref={anchorRef} hidden />
      <SelectField
        key={`drawFormat-${resetKey}`}
        label="Draw format"
        name="drawFormat"
        value={drawFormat}
        onChange={(e) => setDrawFormat(e.target.value as DrawFormat)}
        required
      >
        {Object.entries(drawFormatLabels).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </SelectField>
      <GameFormatPicker
        label={isPools ? "Pool stage game format" : "Game format"}
        fieldPrefix=""
        initial={initialGameFormat}
        selectKey={resetKey}
      />
      {isPools && (
        <GameFormatPicker
          label="Knockout stage game format"
          fieldPrefix="knockout"
          initial={initialKnockoutGameFormat ?? initialGameFormat}
          selectKey={resetKey}
        />
      )}
    </>
  );
}
