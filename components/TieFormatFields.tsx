"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { TextField } from "@/components/TextField";
import { SelectField } from "@/components/SelectField";
import {
  STANDARD_FIVE_MATCH_TIE,
  MIN_TIE_SLOTS,
  MAX_TIE_SLOTS,
  type TieFormatSlotInput,
  type TieSlotType,
} from "@/lib/tournament/tieFormat";
import {
  ALLOWED_GAMES_PER_MATCH,
  MIN_POINTS_PER_GAME,
  MAX_POINTS_PER_GAME,
} from "@/lib/tournament/gameFormat";

const STANDARD_KEY = "STANDARD_5";
const CUSTOM_KEY = "CUSTOM";

function reorder(slots: TieFormatSlotInput[]): TieFormatSlotInput[] {
  return slots.map((s, i) => ({ ...s, order: i + 1 }));
}

function newSlot(order: number): TieFormatSlotInput {
  return { order, label: `Match ${order}`, type: "SINGLES", gamesPerMatch: 3, pointsPerGame: 21 };
}

/** Compares only the fields that matter — a DB-loaded slot also carries `id`/`eventId`, which must not affect the comparison. */
function sameSlots(a: TieFormatSlotInput[], b: TieFormatSlotInput[]): boolean {
  const normalize = (slots: TieFormatSlotInput[]) =>
    slots.map(({ order, label, type, gamesPerMatch, pointsPerGame }) => ({ order, label, type, gamesPerMatch, pointsPerGame }));
  return JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));
}

/**
 * The organizer's tie format for a TEAM event: the standard 5-match preset
 * (3 singles + 2 doubles), or a fully custom slot list. Submits as one hidden
 * JSON field — the server re-validates it with the same `validateTieFormatSlots`
 * this editor uses to keep "Add match" within bounds.
 */
export function TieFormatFields({ initialSlots }: { initialSlots?: TieFormatSlotInput[] }) {
  // A DB-loaded slot also carries `id`/`eventId` — stripped here so they
  // never leak into the hidden JSON field the server parses.
  const normalizedInitialSlots = initialSlots?.map(({ order, label, type, gamesPerMatch, pointsPerGame }) => ({
    order,
    label,
    type,
    gamesPerMatch,
    pointsPerGame,
  }));
  const startsCustom =
    normalizedInitialSlots !== undefined &&
    normalizedInitialSlots.length > 0 &&
    !sameSlots(normalizedInitialSlots, STANDARD_FIVE_MATCH_TIE);
  const [presetKey, setPresetKey] = useState(startsCustom ? CUSTOM_KEY : STANDARD_KEY);
  const [customSlots, setCustomSlots] = useState<TieFormatSlotInput[]>(
    startsCustom ? normalizedInitialSlots! : STANDARD_FIVE_MATCH_TIE,
  );

  const slots = presetKey === STANDARD_KEY ? STANDARD_FIVE_MATCH_TIE : customSlots;

  function updateSlot(index: number, patch: Partial<TieFormatSlotInput>) {
    setCustomSlots((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }
  function addSlot() {
    setCustomSlots((prev) => (prev.length >= MAX_TIE_SLOTS ? prev : reorder([...prev, newSlot(prev.length + 1)])));
  }
  function removeSlot(index: number) {
    setCustomSlots((prev) => (prev.length <= MIN_TIE_SLOTS ? prev : reorder(prev.filter((_, i) => i !== index))));
  }

  return (
    <div className="flex flex-col gap-3">
      <SelectField
        label="Tie format"
        name="tieFormatPreset"
        value={presetKey}
        onChange={(e) => {
          const next = e.target.value;
          if (next === CUSTOM_KEY && presetKey === STANDARD_KEY) {
            setCustomSlots(STANDARD_FIVE_MATCH_TIE);
          }
          setPresetKey(next);
        }}
      >
        <option value={STANDARD_KEY}>Standard 5-match tie (3 singles, 2 doubles)</option>
        <option value={CUSTOM_KEY}>Custom…</option>
      </SelectField>

      <ul className="flex flex-col gap-2">
        {slots.map((slot, i) => (
          <li
            key={i}
            className="flex flex-wrap items-end gap-2 rounded-md border border-border/60 p-2"
          >
            {presetKey === CUSTOM_KEY ? (
              <>
                <TextField
                  label="Label"
                  name={`tieSlotLabel-${i}`}
                  value={slot.label}
                  onChange={(e) => updateSlot(i, { label: e.target.value })}
                  className="w-32"
                />
                <SelectField
                  label="Type"
                  name={`tieSlotType-${i}`}
                  value={slot.type}
                  onChange={(e) => updateSlot(i, { type: e.target.value as TieSlotType })}
                  className="w-28"
                >
                  <option value="SINGLES">Singles</option>
                  <option value="DOUBLES">Doubles</option>
                </SelectField>
                <SelectField
                  label="Games"
                  name={`tieSlotGames-${i}`}
                  value={String(slot.gamesPerMatch)}
                  onChange={(e) => updateSlot(i, { gamesPerMatch: Number(e.target.value) })}
                  className="w-24"
                >
                  {ALLOWED_GAMES_PER_MATCH.map((n) => (
                    <option key={n} value={n}>
                      {n === 1 ? "1 game" : `Best of ${n}`}
                    </option>
                  ))}
                </SelectField>
                <TextField
                  label="Points"
                  name={`tieSlotPoints-${i}`}
                  type="number"
                  inputMode="numeric"
                  min={MIN_POINTS_PER_GAME}
                  max={MAX_POINTS_PER_GAME}
                  value={String(slot.pointsPerGame)}
                  onChange={(e) => updateSlot(i, { pointsPerGame: Number(e.target.value) })}
                  className="w-20"
                />
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => removeSlot(i)}
                  disabled={customSlots.length <= MIN_TIE_SLOTS}
                >
                  Remove
                </Button>
              </>
            ) : (
              <span className="text-sm">
                {slot.order}. {slot.label} — {slot.type === "SINGLES" ? "Singles" : "Doubles"}, best of{" "}
                {slot.gamesPerMatch} to {slot.pointsPerGame}
              </span>
            )}
          </li>
        ))}
      </ul>

      {presetKey === CUSTOM_KEY && (
        <div>
          <Button type="button" variant="secondary" onClick={addSlot} disabled={customSlots.length >= MAX_TIE_SLOTS}>
            Add match
          </Button>
        </div>
      )}

      {/* Chromium injects caret-color:transparent on hidden inputs after
          hydration, which React flags as a mismatch it won't patch up —
          harmless, so it's suppressed. */}
      <input type="hidden" name="tieFormatSlotsJson" value={JSON.stringify(slots)} suppressHydrationWarning />
    </div>
  );
}
