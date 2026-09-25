import type { ComponentProps } from "react";
import { SelectField } from "@/components/SelectField";
import { courtName, courtNumbers } from "@/lib/tournament/courts";

type CourtSelectProps = Omit<ComponentProps<typeof SelectField>, "children"> & {
  /** How many courts the tournament has: the list is Court 1 … Court N. */
  courtCount: number;
  /** "number" submits "3"; "name" submits "Court 3". */
  valueAs?: "number" | "name";
  /** Label for the empty choice (value ""). */
  emptyLabel: string;
  /** Make the empty choice unselectable — for a required field. */
  emptyDisabled?: boolean;
  /** A court name already in use that isn't in the list (say, from before the court count was lowered). */
  legacyValue?: string;
};

export function CourtSelect({
  courtCount,
  valueAs = "number",
  emptyLabel,
  emptyDisabled = false,
  legacyValue,
  ...props
}: CourtSelectProps) {
  const listed = courtNumbers(courtCount).map((n) => ({ value: valueAs === "number" ? String(n) : courtName(n), label: courtName(n) }));
  const showLegacy = legacyValue && !listed.some((c) => c.value === legacyValue);
  return (
    <SelectField {...props}>
      <option value="" disabled={emptyDisabled}>
        {emptyLabel}
      </option>
      {listed.map((court) => (
        <option key={court.value} value={court.value}>
          {court.label}
        </option>
      ))}
      {showLegacy && <option value={legacyValue}>{legacyValue}</option>}
    </SelectField>
  );
}
