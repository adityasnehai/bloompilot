export type ReminderChannel = "email" | "push" | "telegram";

const CHANNEL_PRIORITY: ReminderChannel[] = ["push", "telegram", "email"];

const CHANNEL_LABELS: Record<ReminderChannel, string> = {
  push: "Browser push",
  telegram: "Telegram",
  email: "Email",
};

export function isReminderChannel(value: unknown): value is ReminderChannel {
  return value === "email" || value === "push" || value === "telegram";
}

export function extractReminderChannels(raw: unknown): ReminderChannel[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isReminderChannel);
}

export function normalizeReminderChannels(
  channels: readonly ReminderChannel[],
  fallback: readonly ReminderChannel[] = ["push"],
): ReminderChannel[] {
  const unique = new Set(channels);
  const ordered = CHANNEL_PRIORITY.filter((channel) => unique.has(channel));
  if (ordered.length > 0) return ordered;

  const safeFallback = extractReminderChannels(fallback);
  return safeFallback.length > 0 ? normalizeReminderChannels(safeFallback, ["push"]) : ["push"];
}

export function formatReminderChannelLabel(channel: ReminderChannel) {
  return CHANNEL_LABELS[channel];
}

export function formatReminderChannelSequence(channels: readonly ReminderChannel[]) {
  return normalizeReminderChannels(channels)
    .map(formatReminderChannelLabel)
    .join(" → ");
}

export function describeReminderMode(channels: readonly ReminderChannel[]) {
  const count = normalizeReminderChannels(channels).length;
  if (count <= 1) return "Individual";
  if (count === 2) return "Dual";
  return "All";
}
