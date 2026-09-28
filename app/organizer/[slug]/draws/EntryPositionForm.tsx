"use client";

import { useActionState, useRef } from "react";
import { setEntryPosition, type DrawActionState } from "@/app/actions/draws";
import { FormError } from "@/components/FormError";

const initialState: DrawActionState = {};

/**
 * One entry's bracket position, during a manual draw. Submits itself as soon
 * as a position is picked — parent re-renders with the new current position,
 * so the key it's given there should change with it, forcing a remount that
 * picks up the fresh defaultValue.
 */
export function EntryPositionForm({
  eventId,
  entryId,
  currentPosition,
  availablePositions,
}: {
  eventId: string;
  entryId: string;
  currentPosition: number | null;
  availablePositions: number[];
}) {
  const action = setEntryPosition.bind(null, eventId);
  const [state, formAction] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form action={formAction} ref={formRef} className="flex flex-col items-end gap-1">
      <input type="hidden" name="entryId" value={entryId} />
      <label className="flex items-center gap-2 text-sm">
        Position
        <select
          name="position"
          defaultValue={currentPosition?.toString() ?? ""}
          onChange={() => formRef.current?.requestSubmit()}
          className="rounded-md border border-border bg-surface px-2 py-1 text-sm text-text outline-none focus:border-primary"
        >
          <option value="">Unassigned</option>
          {currentPosition !== null && <option value={currentPosition}>{currentPosition} (current)</option>}
          {availablePositions.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </label>
      <FormError message={state.error} />
    </form>
  );
}
