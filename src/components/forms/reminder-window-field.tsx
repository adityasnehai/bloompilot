"use client";

import { useState } from "react";
import { SlidersHorizontal, Sun, Sunset } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type ReminderWindowFieldProps = {
  defaultSuggested?: string;
  defaultCustom?: string;
};

const PRESETS = [
  { id: "morning",   label: "Morning",   range: "07:00 AM - 09:00 AM", sub: "7 – 9 AM", icon: Sun },
  { id: "afternoon", label: "Afternoon", range: "12:00 PM - 02:00 PM", sub: "12 – 2 PM", icon: Sun },
  { id: "evening",   label: "Evening",   range: "06:00 PM - 08:00 PM", sub: "6 – 8 PM", icon: Sunset },
  { id: "custom",    label: "Custom",    range: "",                     sub: "Choose a time", icon: SlidersHorizontal },
] as const;

type PresetId = (typeof PRESETS)[number]["id"];

function to24h(ampm: string): string {
  const match = ampm.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return "08:00";
  let hour = Number.parseInt(match[1], 10) % 12;
  if (match[3].toUpperCase() === "PM") hour += 12;
  return `${String(hour).padStart(2, "0")}:${match[2]}`;
}

function toAmPm(time24: string): string {
  const [hStr, mStr] = time24.split(":");
  const hour = Number.parseInt(hStr, 10);
  const min = mStr ?? "00";
  const meridian = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 || 12;
  return `${String(h12).padStart(2, "0")}:${min} ${meridian}`;
}

function detectPreset(window: string): PresetId {
  const preset = PRESETS.find((p) => p.range === window);
  return preset ? preset.id : "custom";
}

export function ReminderWindowField({
  defaultSuggested = "07:00 AM - 09:00 AM",
  defaultCustom = "",
}: ReminderWindowFieldProps) {
  const initial = defaultCustom ? "custom" : detectPreset(defaultSuggested);
  const [selected, setSelected] = useState<PresetId>(initial);

  const initFrom = defaultCustom
    ? to24h(defaultCustom.split("-")[0] ?? "")
    : "08:00";
  const initTo = defaultCustom
    ? to24h(defaultCustom.split("-")[1] ?? "")
    : "10:00";

  const [customFrom, setCustomFrom] = useState(initFrom);
  const [customTo, setCustomTo]     = useState(initTo);

  const selectedPreset = PRESETS.find((p) => p.id === selected)!;
  const reminderWindowValue = selected === "custom" ? "" : selectedPreset.range;
  const customWindowValue   = selected === "custom"
    ? `${toAmPm(customFrom)} - ${toAmPm(customTo)}`
    : "";

  return (
    <div className="grid gap-4">
      <span className="text-sm font-semibold text-[var(--color-ink)]">Reminder window</span>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {PRESETS.map((preset) => {
          const active = selected === preset.id;
          const Icon = preset.icon;
          return (
            <Button
              key={preset.id}
              type="button"
              onClick={() => setSelected(preset.id)}
              variant="outline"
              className={cn(
                "h-auto flex-col items-start gap-2 rounded-2xl border-white/10 bg-white/[.03] p-3 text-left hover:bg-white/[.08] sm:p-4",
                active && "border-[var(--color-line)] bg-white/[.03]",
              )}
            >
              <span className="flex w-full items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-sm font-medium text-[var(--color-ink)]">
                  <Icon className="h-4 w-4 text-white/55" aria-hidden />
                  {preset.label}
                </span>
                <span
                  aria-label={active ? "Selected" : "Not selected"}
                  className={cn(
                    "h-2.5 w-2.5 rounded-full border",
                    active
                      ? "border-[var(--color-canopy)] bg-[var(--color-canopy)]"
                      : "border-white/25",
                  )}
                />
              </span>
              <span className="text-xs text-[var(--color-muted)]">{preset.sub}</span>
            </Button>
          );
        })}
      </div>

      {selected === "custom" && (
        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-[var(--color-ink)]">From</span>
            <Input
              type="time"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-[var(--color-ink)]">To</span>
            <Input
              type="time"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
            />
          </label>
        </div>
      )}

      <input type="hidden" name="reminderWindow"       value={reminderWindowValue} />
      <input type="hidden" name="customReminderWindow" value={customWindowValue}   />
    </div>
  );
}
