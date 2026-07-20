import { redirect } from "next/navigation";
import { runReminderSweepAction, sendTelegramTestAction } from "@/app/reminder-actions";
import {
  describeTaskTiming,
  formatDateTime,
  getDueTodayTasks,
  getOverdueTasks,
  getUpcomingTasks,
  readGardenState,
} from "@/lib/garden";
import {
  readCurrentReminderChannelReadiness,
  readLatestReminderRun,
  type ReminderDelivery,
} from "@/lib/reminders";
import {
  describeReminderMode,
  formatReminderChannelSequence,
} from "@/lib/reminder-channels";
import { requireSession } from "@/lib/session";

function formatChannelLabel(channel: ReminderDelivery["channel"]) {
  if (channel === "push") return "Browser push";
  if (channel === "telegram") return "Telegram";
  return "Email";
}

function formatDeliveryStatus(status: ReminderDelivery["status"]) {
  if (status === "sent") {
    return {
      label: "Sent",
      className: "border-[var(--color-line)] bg-[var(--color-canvas-mint)] text-[var(--color-ink)]",
    };
  }

  if (status === "failed") {
    return {
      label: "Failed",
      className: "border-[var(--color-line-strong)] bg-[var(--color-canvas-soft)] text-[var(--color-ink)]",
    };
  }

  return {
    label: "Queued",
    className: "border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-muted)]",
  };
}

function formatSuppressionReason(reason: string) {
  switch (reason) {
    case "outside_reminder_window":
      return "Outside the selected reminder window.";
    case "not_due_in_window_yet":
      return "This task is valid, but its send slot has not arrived yet.";
    case "digest_not_due_in_window_yet":
      return "Low-priority digest is scheduled for the next allowed send window.";
    case "watering_suppressed_by_weather_or_skip_rule":
      return "Watering was skipped because weather or plant rules say not to water now.";
    case "duplicate_watering_in_same_window":
      return "Another watering reminder already covers this plant in the same window.";
    case "max_reminder_events_per_user_per_day_reached":
      return "Daily reminder cap reached for this user.";
    case "minimum_spacing_between_live_reminders_not_elapsed":
      return "BloomPilot is spacing reminders to avoid back-to-back sends.";
    case "max_reminders_per_plant_per_day_reached":
      return "Daily reminder cap reached for this plant.";
    case "max_escalations_per_plant_per_day_reached":
      return "Escalation cap reached for this plant today.";
    case "idempotency_duplicate_within_dedupe_window":
      return "This reminder was already sent recently and was deduplicated.";
    case "no_active_push_subscription":
      return "Browser push is selected, but this browser is not subscribed yet.";
    case "missing_telegram_connection":
      return "Telegram is selected, but the BloomPilot bot is not connected yet.";
    default:
      return reason.replaceAll("_", " ");
  }
}

function formatSuppressionChannel(channel: string) {
  if (channel === "all") return "All channels";
  if (channel === "push") return "Browser push";
  if (channel === "telegram") return "Telegram";
  return "Email";
}

function groupSuppressionReasons(
  reasons: Array<{ channel: string; reason: string }>,
) {
  const grouped = new Map<string, { count: number; channel: string; message: string }>();

  for (const item of reasons) {
    const key = `${item.channel}:${item.reason}`;
    grouped.set(key, {
      count: (grouped.get(key)?.count ?? 0) + 1,
      channel: formatSuppressionChannel(item.channel),
      message: formatSuppressionReason(item.reason),
    });
  }

  return [...grouped.values()];
}

function channelSummaryCard(params: {
  label: string;
  description: string;
  state: "ready" | "needs_setup" | "not_selected";
}) {
  const tone =
    params.state === "ready"
      ? "border-[var(--color-line)] bg-[var(--color-canvas-mint)] text-[var(--color-ink)]"
      : params.state === "needs_setup"
        ? "border-[var(--color-line-strong)] bg-[var(--color-canvas-soft)] text-[var(--color-ink)]"
        : "border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-muted)]";

  const label =
    params.state === "ready"
      ? "Ready"
      : params.state === "needs_setup"
        ? "Needs setup"
        : "Not selected";

  return (
    <article className="min-w-0 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-3 shadow-[0_4px_14px_rgba(24,36,27,0.03)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[var(--color-ink)]">{params.label}</p>
          <p className="mt-1 text-xs leading-5 text-[var(--color-muted)]">
            {params.description}
          </p>
        </div>
        <span className={`inline-flex shrink-0 whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-semibold ${tone}`}>
          {label}
        </span>
      </div>
    </article>
  );
}

export default async function RemindersPage({
  searchParams,
}: {
  searchParams?: Promise<{
    telegramTest?: string;
    error?: string;
  }>;
}) {
  const session = await requireSession();
  const resolvedSearchParams = await searchParams;

  if (!session.onboarded) {
    redirect("/onboarding");
  }

  const [gardenState, reminderRun, readiness] = await Promise.all([
    readGardenState(),
    readLatestReminderRun(),
    readCurrentReminderChannelReadiness(),
  ]);

  const overdueTasks = getOverdueTasks(gardenState.tasks).slice(0, 3);
  const dueTodayTasks = getDueTodayTasks(gardenState.tasks).slice(0, 3);
  const upcomingTasks = getUpcomingTasks(gardenState.tasks).slice(0, 3);
  const groupedSuppressions = groupSuppressionReasons(
    reminderRun?.payload.suppression_reasons ?? [],
  );
  const failedDeliveries =
    reminderRun?.payload.deliveries.filter((item) => item.status === "failed") ?? [];
  const telegramTestState = resolvedSearchParams?.telegramTest ?? null;
  const telegramTestError = resolvedSearchParams?.error ?? null;
  const reminderMode = describeReminderMode(session.channels);
  const reminderOrder = formatReminderChannelSequence(session.channels);

  return (
    <div className="grid gap-4">
      <section className="surface-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="eyebrow">Notifications</p>
            <h1 className="mt-1 text-2xl font-semibold text-[var(--color-ink)]">Reminders</h1>
            <p className="mt-1 max-w-xl text-sm leading-6 text-[var(--color-muted)]">Check delivery readiness, recent sends, and anything that needs attention.</p>
          </div>
          <form action={runReminderSweepAction}>
            <input type="hidden" name="returnTo" value="/reminders" />
            <button type="submit" className="button-primary">
              Run check
            </button>
          </form>
        </div>

        {telegramTestState === "sent" ? (
          <div className="mt-3 rounded-lg border border-[var(--color-line)] bg-[var(--color-canvas-mint)] px-3 py-2 text-sm text-[var(--color-ink)]">
            Telegram test sent.
          </div>
        ) : null}
        {telegramTestState === "not_connected" ? (
          <div className="mt-3 rounded-lg border border-[var(--color-line-strong)] bg-[var(--color-canvas-soft)] px-3 py-2 text-sm text-[var(--color-ink)]">
            Connect Telegram in Settings first.
          </div>
        ) : null}
        {telegramTestState === "failed" ? (
          <div className="mt-3 rounded-lg border border-[var(--color-line-strong)] bg-[var(--color-canvas-soft)] px-3 py-2 text-sm text-[var(--color-ink)]">
            Telegram test failed{telegramTestError ? `: ${telegramTestError}` : "."}
          </div>
        ) : null}

        {session.telegramChatId && readiness?.telegramReady ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--color-line)] bg-[var(--color-canvas-sage)] px-3 py-2">
            <div>
              <p className="text-sm font-medium text-[var(--color-ink)]">Telegram test</p>
              <p className="mt-1 text-xs text-[var(--color-muted)]">
                Send a test to your connected chat.
              </p>
            </div>
            <form action={sendTelegramTestAction}>
              <input type="hidden" name="returnTo" value="/reminders" />
              <button type="submit" className="button-secondary">
                Send test
              </button>
            </form>
          </div>
        ) : null}

        <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          <article className="min-w-0 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-muted)]">
              Window
            </p>
            <p className="mt-1 text-base font-semibold text-[var(--color-ink)]">
              {readiness?.reminderWindow ?? session.reminderWindow}
            </p>
          </article>
          <article className="min-w-0 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-muted)]">
              Sent
            </p>
            <p className="mt-1 text-base font-semibold text-[var(--color-ink)]">
              {reminderRun?.payload.sent_count ?? 0}
            </p>
          </article>
          <article className="min-w-0 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-muted)]">
              Suppressed
            </p>
            <p className="mt-1 text-base font-semibold text-[var(--color-ink)]">
              {reminderRun?.payload.suppressed_count ?? 0}
            </p>
          </article>
          <article className="min-w-0 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-muted)]">
              Failed
            </p>
            <p className="mt-1 text-base font-semibold text-[var(--color-ink)]">
              {reminderRun?.payload.failed_count ?? 0}
            </p>
          </article>
        </div>

        <div className="mt-3 rounded-lg border border-[var(--color-line)] bg-[var(--color-canvas-soft)] px-3 py-2 text-xs leading-5 text-[var(--color-muted)]">
          {reminderMode} · Priority: {reminderOrder}
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="grid gap-4">
          <section className="surface-panel p-5">
            <p className="eyebrow">Channels</p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--color-ink)]">Available channels</h2>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {channelSummaryCard({
                label: "In-app queue",
                description: "Available in BloomPilot.",
                state: "ready",
              })}
              {channelSummaryCard({
                label: "Email",
                description: "Uses your account email.",
                state: readiness?.email ? "ready" : "not_selected",
              })}
              {channelSummaryCard({
                label: "Browser push",
                description:
                  readiness?.pushSelected && !readiness.pushReady
                    ? "Selected, but this browser is not subscribed."
                    : "Notifications on this browser.",
                state: !readiness?.pushSelected
                  ? "not_selected"
                  : readiness.pushReady
                    ? "ready"
                    : "needs_setup",
              })}
              {channelSummaryCard({
                label: "Telegram",
                description:
                  readiness?.telegramSelected && !readiness.telegramReady
                    ? "Selected, but Telegram is not connected."
                    : readiness?.telegramChatId
                      ? "Connected to your Telegram bot chat."
                      : "Connect your Telegram bot to use it.",
                state: !readiness?.telegramSelected
                  ? "not_selected"
                  : readiness.telegramReady
                    ? "ready"
                    : "needs_setup",
              })}
            </div>
          </section>

          <section className="surface-panel p-5">
            <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="eyebrow">Latest run</p>
                <h2 className="mt-1 text-lg font-semibold text-[var(--color-ink)]">
                  {reminderRun?.payload.headline ?? "No reminder runs yet."}
                </h2>
                <p className="mt-1 text-sm leading-5 text-[var(--color-muted)]">
                  {reminderRun?.payload.summary ??
                    "Your first reminder summary will appear here after the first run."}
                </p>
              </div>
              <span className="shrink-0 rounded-full border border-[var(--color-line)] bg-[var(--color-canvas-soft)] px-3 py-1 text-xs text-[var(--color-muted)]">
                {reminderRun ? formatDateTime(reminderRun.createdAt) : "Not run yet"}
              </span>
            </div>

            <div className="mt-3 grid gap-2">
              {reminderRun?.payload.deliveries.length ? (
                reminderRun.payload.deliveries.map((delivery) => {
                  const status = formatDeliveryStatus(delivery.status);

                  return (
                    <article key={delivery.id} className="surface-card min-w-0 px-3 py-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-[var(--color-ink)]">
                            {delivery.title}
                          </p>
                          <p className="mt-1 text-xs leading-5 text-[var(--color-muted)]">
                            {delivery.preview}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <span className="rounded-full border border-[var(--color-line)] bg-[var(--color-canvas-soft)] px-3 py-1 text-[11px] font-semibold text-[var(--color-muted)]">
                            {formatChannelLabel(delivery.channel)}
                          </span>
                          <span className={`inline-flex shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-[11px] font-semibold ${status.className}`}>
                            {status.label}
                          </span>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="rounded-full border border-[var(--color-line)] bg-[var(--color-canvas-soft)] px-3 py-1 text-xs text-[var(--color-muted)]">
                          Window {delivery.scheduledWindow}
                        </span>
                      </div>
                      {delivery.items.length > 0 ? (
                        <div className="mt-2 grid gap-1">
                          {delivery.items.map((item) => (
                            <p key={item} className="text-sm text-[var(--color-ink)]">
                              {item}
                            </p>
                          ))}
                        </div>
                      ) : null}
                      {delivery.status === "failed" && delivery.errorMessage ? (
                        <p className="mt-2 text-xs text-[var(--color-muted)]">
                          {delivery.errorMessage}
                        </p>
                      ) : null}
                    </article>
                  );
                })
              ) : (
                <div className="surface-card-muted px-4 py-4 text-sm text-[var(--color-muted)]">
                  No delivery was sent in the latest run.
                </div>
              )}
            </div>
          </section>

          <section className="surface-panel p-5">
            <p className="eyebrow">Blocked sends</p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--color-ink)]">Why reminders were held</h2>
            <div className="mt-3 grid gap-2">
              {groupedSuppressions.length > 0 ? (
                groupedSuppressions.map((item) => (
                  <article key={`${item.channel}:${item.message}`} className="surface-card px-3 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[var(--color-ink)]">
                          {item.message}
                        </p>
                        <p className="mt-1 text-xs text-[var(--color-muted)]">
                          {item.channel}
                        </p>
                      </div>
                      <span className="rounded-full border border-[var(--color-line)] bg-[var(--color-canvas-soft)] px-3 py-1 text-xs font-medium text-[var(--color-muted)]">
                        {item.count}
                      </span>
                    </div>
                  </article>
                ))
              ) : (
                <div className="surface-card-muted px-4 py-4 text-sm text-[var(--color-muted)]">
                  No reminders were held in the latest run.
                </div>
              )}
            </div>
          </section>
        </section>

        <aside className="grid content-start gap-4">
          <section className="surface-panel p-5">
            <p className="eyebrow">Today</p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--color-ink)]">
              Today&apos;s actions
            </h2>
            <div className="mt-3 grid gap-2">
              {[{
                label: "Overdue",
                tasks: overdueTasks,
                empty: "No overdue tasks right now.",
              }, {
                label: "Due today",
                tasks: dueTodayTasks,
                empty: "No same-day tasks waiting.",
              }, {
                label: "Upcoming",
                tasks: upcomingTasks,
                empty: "No upcoming tasks yet.",
              }].map((group) => (
                <div key={group.label} className="surface-card px-3 py-3">
                  <p className="text-sm font-medium text-[var(--color-ink)]">{group.label}</p>
                  <div className="mt-2 grid gap-2">
                    {group.tasks.length > 0 ? (
                      group.tasks.map((task) => (
                        <p key={task.id} className="text-xs text-[var(--color-muted)]">
                          {task.title} · {describeTaskTiming(task.dueDate)}
                        </p>
                      ))
                    ) : (
                      <p className="text-xs text-[var(--color-muted)]">{group.empty}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="surface-panel p-5">
            <p className="eyebrow">Setup</p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--color-ink)]">Fix next</h2>
            <div className="mt-3 grid gap-2">
              {failedDeliveries.length > 0 ? (
                failedDeliveries.map((delivery) => (
                  <div key={delivery.id} className="surface-card px-3 py-3">
                    <p className="text-sm font-semibold text-[var(--color-ink)]">
                      {formatChannelLabel(delivery.channel)}
                    </p>
                    <p className="mt-1 text-xs text-[var(--color-muted)]">
                      {delivery.errorMessage ?? "Delivery failed in the latest run."}
                    </p>
                  </div>
                ))
              ) : (
                <div className="surface-card px-3 py-3">
                  <p className="text-xs text-[var(--color-muted)]">
                    No provider failures in the latest run.
                  </p>
                </div>
              )}
              {!readiness?.pushReady && readiness?.pushSelected ? (
                <div className="surface-card px-3 py-3">
                  <p className="text-sm font-semibold text-[var(--color-ink)]">
                    Enable browser push on this device
                  </p>
                  <p className="mt-1 text-xs text-[var(--color-muted)]">
                    Push is selected, but this browser is not subscribed yet.
                  </p>
                </div>
              ) : null}
              {!readiness?.telegramReady && readiness?.telegramSelected ? (
                <div className="surface-card px-3 py-3">
                  <p className="text-sm font-semibold text-[var(--color-ink)]">
                    Connect Telegram
                  </p>
                  <p className="mt-1 text-xs text-[var(--color-muted)]">
                    Connect the BloomPilot Telegram bot from Settings before selecting this channel.
                  </p>
                </div>
              ) : null}
              {readiness && failedDeliveries.length === 0 &&
              (readiness?.pushReady || !readiness?.pushSelected) &&
              (readiness?.telegramReady || !readiness?.telegramSelected) ? (
                <div className="surface-card px-3 py-3">
                  <p className="text-xs text-[var(--color-muted)]">No setup issues found.</p>
                </div>
              ) : null}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
