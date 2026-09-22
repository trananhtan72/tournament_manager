"use client";

import { useState } from "react";
import { TextField } from "@/components/TextField";
import { SelectField } from "@/components/SelectField";
import { EVENT_NAME_PRESETS, OTHER_EVENT_NAME, categoryLabels } from "@/lib/eventLabels";
import type { EventCategory } from "@prisma/client";

export function EventNameFields({
  initialName,
  initialCategory,
}: {
  initialName?: string;
  initialCategory?: EventCategory;
}) {
  const matchingPreset = EVENT_NAME_PRESETS.find(
    (p) => p.name === initialName && p.category === initialCategory,
  );
  const isEditMode = initialName !== undefined;

  const [selected, setSelected] = useState(() => {
    if (matchingPreset) return matchingPreset.name;
    if (isEditMode) return OTHER_EVENT_NAME;
    return EVENT_NAME_PRESETS[0].name;
  });
  const [customName, setCustomName] = useState(matchingPreset ? "" : (initialName ?? ""));
  const [customCategory, setCustomCategory] = useState<EventCategory>(
    initialCategory ?? "SINGLES",
  );

  const isOther = selected === OTHER_EVENT_NAME;
  const preset = EVENT_NAME_PRESETS.find((p) => p.name === selected);
  const finalName = isOther ? customName : (preset?.name ?? "");
  const finalCategory = isOther ? customCategory : (preset?.category ?? "SINGLES");

  return (
    <>
      <SelectField
        label="Event name"
        name="eventNamePreset"
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
      >
        {EVENT_NAME_PRESETS.map((p) => (
          <option key={p.name} value={p.name}>
            {p.name}
          </option>
        ))}
        <option value={OTHER_EVENT_NAME}>Other…</option>
      </SelectField>
      {isOther && (
        <>
          <TextField
            label="Custom event name"
            name="customEventName"
            type="text"
            required
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
          />
          <SelectField
            label="Category"
            name="customEventCategory"
            value={customCategory}
            onChange={(e) => setCustomCategory(e.target.value as EventCategory)}
          >
            {Object.entries(categoryLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </SelectField>
        </>
      )}
      {/* Chromium injects caret-color:transparent on hidden inputs after
          hydration, which React flags as a mismatch it won't patch up —
          harmless, so it's suppressed here. */}
      <input type="hidden" name="name" value={finalName} suppressHydrationWarning />
      <input type="hidden" name="category" value={finalCategory} suppressHydrationWarning />
    </>
  );
}
