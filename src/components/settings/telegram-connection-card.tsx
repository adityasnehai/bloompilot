import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type TelegramConnectionCardProps = {
  connectUrl: string | null;
  connected: boolean;
};

export function TelegramConnectionCard({ connectUrl, connected }: TelegramConnectionCardProps) {
  return (
    <Card className="px-4 py-4">
      <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-muted)]">Telegram reminders</p>
      <p className="mt-2 text-sm leading-6 text-[var(--color-ink)]">
        Connect the BloomPilot Telegram bot to receive free external reminders.
      </p>
      <p className="mt-2 text-xs leading-5 text-[var(--color-muted)]">
        Status: {connected ? "connected" : "not connected"}
      </p>
      {connectUrl ? (
        <Button asChild variant="outline" className="mt-4 rounded-full">
          <a href={connectUrl} target="_blank" rel="noreferrer">
            {connected ? "Reconnect Telegram" : "Connect Telegram"}
          </a>
        </Button>
      ) : (
        <p className="mt-3 text-xs text-[var(--color-muted)]">
          Telegram is not configured yet. Add the bot username and token to the environment.
        </p>
      )}
    </Card>
  );
}
