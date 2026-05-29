"use client";

import { useMemo, useState } from "react";

type ReminderWindowFieldProps = {
  defaultSuggested?: string;
  defaultCustom?: string;
};

const suggestedWindows = [
  "07:00 AM - 09:00 AM",
  "12:00 PM - 02:00 PM",
  "06:00 PM - 08:00 PM",
];

function splitCustomWindow(value: string) {
  const [from = "", to = ""] = value.split("-").map((part) => part.trim());
  return { from, to };
}

export function ReminderWindowField({
  defaultSuggested = "07:00 AM - 09:00 AM",
  defaultCustom = "",
}: ReminderWindowFieldProps) {
  const initialMode = defaultCustom ? "Custom" : defaultSuggested;
  const [selectedMode, setSelectedMode] = useState(initialMode);
  const initialCustom = useMemo(() => splitCustomWindow(defaultCustom), [defaultCustom]);
  const [customFrom, setCustomFrom] = useState(initialCustom.from || "08:00 AM");
  const [customTo, setCustomTo] = useState(initialCustom.to || "10:00 AM");
  const customWindow = `${customFrom} - ${customTo}`;

  return (
    <div className="grid gap-5">
      <label className="flex flex-col gap-2">
        <span className="field-label">Suggested reminder window</span>
        <select
          name="reminderWindow"
          value={selectedMode}
          onChange={(event) => setSelectedMode(event.target.value)}
          className="field-control"
        >
          {suggestedWindows.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
          <option value="Custom">Custom</option>
        </select>
      </label>

      {selectedMode === "Custom" ? (
        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-2">
            <span className="field-label">From</span>
            <input
              type="text"
              value={customFrom}
              onChange={(event) => setCustomFrom(event.target.value)}
              placeholder="08:00 AM"
              className="field-control"
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="field-label">To</span>
            <input
              type="text"
              value={customTo}
              onChange={(event) => setCustomTo(event.target.value)}
              placeholder="10:00 AM"
              className="field-control"
            />
          </label>
          <input type="hidden" name="customReminderWindow" value={customWindow} />
          <p className="md:col-span-2 field-hint">
            Use AM/PM format, for example `08:00 AM` to `10:00 AM`.
          </p>
        </div>
      ) : (
        <input type="hidden" name="customReminderWindow" value="" />
      )}
    </div>
  );
}
