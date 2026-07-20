"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell, Mail, Send } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  normalizeReminderChannels,
  type ReminderChannel,
} from "@/lib/reminder-channels";

type ReminderChannelFieldProps = {
  defaultChannels?: ReminderChannel[];
  hint?: string;
  onChange?: (channels: ReminderChannel[]) => void;
};

const channelOptions = [
  {
    value: "push",
    label: "Browser push",
    icon: Bell,
  },
  {
    value: "telegram",
    label: "Telegram",
    icon: Send,
  },
  {
    value: "email",
    label: "Email",
    icon: Mail,
  },
] as const;

export function ReminderChannelField({
  defaultChannels = ["push"],
  hint = "",
  onChange,
}: ReminderChannelFieldProps) {
  const initialChannels = useMemo(() => {
    return normalizeReminderChannels(defaultChannels, ["push"]);
  }, [defaultChannels]);

  const [channels, setChannels] = useState<ReminderChannel[]>(initialChannels);

  useEffect(() => {
    onChange?.(channels);
  }, [channels, onChange]);

  return (
    <fieldset className="grid gap-4">
      <legend className="text-sm font-semibold text-[var(--color-ink)]">Reminder channels</legend>
      <div className="mt-2 grid gap-3 md:grid-cols-3">
        {channelOptions.map((option) => {
          const selected = channels.includes(option.value);
          const isOnlySelected = selected && channels.length === 1;
          const Icon = option.icon;

          return (
            <Card
              key={option.value}
              className="min-h-[68px] border-[var(--color-line)] p-3 transition sm:p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/[.08] text-white/65">
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <p className="text-sm font-medium text-[var(--color-ink)]">{option.label}</p>
                </div>
                <Switch
                  checked={selected}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setChannels((previous) =>
                        previous.includes(option.value) ? previous : [...previous, option.value],
                      );
                      return;
                    }

                    if (channels.length === 1) return;

                    setChannels((previous) => previous.filter((item) => item !== option.value));
                  }}
                  disabled={isOnlySelected}
                  className="data-[state=checked]:border-[var(--color-canopy)] data-[state=checked]:bg-[var(--color-canopy)]"
                />
              </div>
            </Card>
          );
        })}
      </div>
      {hint ? <p className="text-xs text-[var(--color-muted)]">{hint}</p> : null}
      {channels.map((channel) => (
        <input key={channel} type="hidden" name="channels" value={channel} />
      ))}
    </fieldset>
  );
}
