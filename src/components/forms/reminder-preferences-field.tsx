"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ReminderChannelField } from "@/components/forms/reminder-channel-field";
import { ReminderWindowField } from "@/components/forms/reminder-window-field";
import type { ReminderChannel } from "@/lib/reminder-channels";

type ReminderPreferencesFieldProps = {
  defaultSuggested?: string;
  defaultCustom?: string;
  defaultChannels?: Array<"email" | "push" | "telegram">;
  accountEmail: string;
};

export function ReminderPreferencesField({
  defaultSuggested,
  defaultCustom,
  defaultChannels = ["push"],
  accountEmail,
}: ReminderPreferencesFieldProps) {
  const [channels, setChannels] =
    useState<ReminderChannel[]>(defaultChannels.length > 0 ? defaultChannels : ["push"]);

  return (
    <div className="grid gap-5">
      <ReminderWindowField
        defaultSuggested={defaultSuggested}
        defaultCustom={defaultCustom}
      />

      <ReminderChannelField
        defaultChannels={defaultChannels}
        onChange={setChannels}
      />

      {channels.includes("email") ? (
        <Card className="p-4">
          <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[10px] uppercase tracking-[0.16em]">
            Email delivery
          </Badge>
          <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">
            Sends to <span className="font-medium text-[var(--color-ink)]">{accountEmail}</span>.
          </p>
        </Card>
      ) : null}

      {channels.includes("telegram") ? (
        <Card className="p-4">
          <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[10px] uppercase tracking-[0.16em]">
            Telegram connection
          </Badge>
          <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">
            Connect Telegram in Settings before Telegram reminders can be sent.
          </p>
        </Card>
      ) : null}
    </div>
  );
}
