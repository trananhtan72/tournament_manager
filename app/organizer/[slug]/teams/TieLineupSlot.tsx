"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { TieLineupSlotForm } from "@/app/organizer/[slug]/teams/TieLineupSlotForm";

export function TieLineupSlot({
  tieId,
  slotOrder,
  side,
  roster,
  neededPlayers,
  currentLabel,
  locked,
}: {
  tieId: string;
  slotOrder: number;
  side: 1 | 2;
  roster: { id: string; label: string }[];
  neededPlayers: 1 | 2;
  /** null when this side hasn't submitted a lineup for this slot yet. */
  currentLabel: string | null;
  /** True once the rubber has a result — the lineup can no longer be changed. */
  locked: boolean;
}) {
  const [editing, setEditing] = useState(currentLabel === null);

  if (!editing) {
    return (
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{currentLabel}</span>
        {!locked && (
          <Button type="button" variant="secondary" onClick={() => setEditing(true)}>
            Edit
          </Button>
        )}
      </div>
    );
  }

  return (
    <TieLineupSlotForm
      tieId={tieId}
      slotOrder={slotOrder}
      side={side}
      roster={roster}
      neededPlayers={neededPlayers}
    />
  );
}
