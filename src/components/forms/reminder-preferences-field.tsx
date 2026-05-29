"use client";

import { useState } from "react";
import { ReminderWindowField } from "@/components/forms/reminder-window-field";

type ReminderPreferencesFieldProps = {
  defaultSuggested?: string;
  defaultCustom?: string;
  defaultChannels?: Array<"email" | "push" | "whatsapp">;
};

const channelOptions = [
  {
    value: "push",
    label: "In-app",
    hint: "Best default for quick daily actions.",
  },
  {
    value: "email",
    label: "Email",
    hint: "Useful for digests and backup reminders.",
  },
  {
    value: "whatsapp",
    label: "WhatsApp",
    hint: "Planned channel for direct nudges.",
  },
] as const;

export function ReminderPreferencesField({
  defaultSuggested,
  defaultCustom,
  defaultChannels = ["push"],
}: ReminderPreferencesFieldProps) {
  const [channels, setChannels] =
    useState<Array<"email" | "push" | "whatsapp">>(defaultChannels);

  return (
    <div className="grid gap-5">
      <ReminderWindowField
        defaultSuggested={defaultSuggested}
        defaultCustom={defaultCustom}
      />

      <fieldset className="grid gap-3">
        <legend className="field-label">Reminder channels</legend>
        <div className="grid gap-3 md:grid-cols-3">
          {channelOptions.map((option) => {
            const selected = channels.includes(option.value);
            return (
              <label
                key={option.value}
                className={`choice-card cursor-pointer p-4 ${
                  selected
                    ? "border-[var(--color-moss)] ring-2 ring-[rgba(76,121,97,0.14)]"
                    : ""
                }`}
              >
                <input
                  type="checkbox"
                  name="channels"
                  value={option.value}
                  checked={selected}
                  onChange={(event) => {
                    if (event.target.checked) {
                      setChannels((previous) =>
                        previous.includes(option.value)
                          ? previous
                          : [...previous, option.value],
                      );
                    } else {
                      setChannels((previous) =>
                        previous.filter((item) => item !== option.value),
                      );
                    }
                  }}
                  className="mt-1 h-4 w-4 rounded border-[rgba(16,52,39,0.3)] text-[var(--color-canopy)] focus:ring-[var(--color-moss)]"
                />
                <span className="space-y-1">
                  <span className="block text-sm font-medium text-[var(--color-ink)]">
                    {option.label}
                  </span>
                  <span className="block text-xs leading-5 text-[var(--color-muted)]">
                    {option.hint}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
        <p className="field-hint">Select one or more channels.</p>
      </fieldset>

      <label className="choice-card cursor-pointer p-4">
        <input
          type="checkbox"
          name="smartWeatherAdjust"
          defaultChecked
          className="mt-1 h-4 w-4 rounded border-[rgba(16,52,39,0.3)] text-[var(--color-canopy)] focus:ring-[var(--color-moss)]"
        />
        <span className="space-y-1">
          <span className="block text-sm font-medium text-[var(--color-ink)]">
            Smart weather adjust
          </span>
          <span className="block text-xs leading-5 text-[var(--color-muted)]">
            Auto-delay or skip watering reminders when weather conditions already cover the need.
          </span>
        </span>
      </label>
    </div>
  );
}
