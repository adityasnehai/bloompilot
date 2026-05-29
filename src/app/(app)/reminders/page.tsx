import { redirect } from "next/navigation";
import { runReminderSweepAction } from "@/app/reminder-actions";
import {
  describeTaskTiming,
  formatDateTime,
  getDueTodayTasks,
  getOverdueTasks,
  getUpcomingTasks,
  readGardenState,
} from "@/lib/garden";
import { readOrCreateLatestReminderRun } from "@/lib/reminders";
import { requireSession } from "@/lib/session";

export default async function RemindersPage() {
  const session = await requireSession();

  if (!session.onboarded) {
    redirect("/onboarding");
  }

  const [gardenState, reminderRun] = await Promise.all([
    readGardenState(),
    readOrCreateLatestReminderRun(),
  ]);

  const overdueTasks = getOverdueTasks(gardenState.tasks).slice(0, 3);
  const dueTodayTasks = getDueTodayTasks(gardenState.tasks).slice(0, 3);
  const upcomingTasks = getUpcomingTasks(gardenState.tasks).slice(0, 3);

  return (
    <div className="grid gap-6">
      <section className="surface-panel px-5 py-6 sm:px-6">
        <p className="text-sm text-[var(--color-muted)]">Reminders</p>
        <h2 className="mt-2 text-2xl font-semibold text-[var(--color-ink)]">Reminder queue</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
          Review the latest reminder batch and refresh it when tasks change.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <form action={runReminderSweepAction}>
            <input type="hidden" name="returnTo" value="/reminders" />
            <button type="submit" className="button-primary">
              Refresh reminders
            </button>
          </form>
          <span className="text-sm text-[var(--color-muted)]">
            {session.channels.join(" + ")} · {session.reminderWindow}
          </span>
        </div>
      </section>

      <section className="surface-panel px-5 py-6 sm:px-6">
        <p className="text-sm text-[var(--color-muted)]">Latest run</p>
        <h3 className="mt-1 text-xl font-semibold text-[var(--color-ink)]">
          {reminderRun?.payload.headline ?? "No reminder runs yet."}
        </h3>
        <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
          {reminderRun?.payload.summary ??
            "Your first reminder summary will appear here after the first refresh."}
        </p>
        <p className="mt-3 text-sm text-[var(--color-muted)]">
          {reminderRun ? formatDateTime(reminderRun.createdAt) : "Not run yet"} · {reminderRun?.trigger ?? "auto"}
        </p>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="surface-panel px-5 py-6 sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="eyebrow">Delivery queue</p>
              <h3 className="mt-2 text-2xl font-semibold text-[var(--color-ink)]">
                Ready-to-send reminders
              </h3>
            </div>
            <span className="rounded-full border border-[rgba(16,52,39,0.08)] bg-white px-3 py-1 text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">
              {reminderRun?.payload.deliveryCount ?? 0} queued
            </span>
          </div>

          <div className="mt-6 grid gap-4">
            {reminderRun?.payload.deliveries.length ? (
              reminderRun.payload.deliveries.map((delivery) => (
                <article
                  key={delivery.id}
                  className="surface-card px-4 py-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-[var(--color-ink)]">
                        {delivery.title}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
                        {delivery.preview}
                      </p>
                    </div>
                    <span className="rounded-full bg-[rgba(76,121,97,0.08)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-moss)]">
                      {delivery.channel}
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="rounded-full border border-[rgba(16,52,39,0.08)] bg-[rgba(245,237,222,0.82)] px-3 py-1 text-xs text-[var(--color-muted)]">
                      Window {delivery.scheduledWindow}
                    </span>
                    <span className="rounded-full border border-[rgba(16,52,39,0.08)] bg-white px-3 py-1 text-xs text-[var(--color-muted)]">
                      Status {delivery.status}
                    </span>
                  </div>
                  <div className="mt-4 grid gap-2">
                    {delivery.items.map((item) => (
                      <p key={item} className="text-sm text-[var(--color-ink)]">
                        {item}
                      </p>
                    ))}
                  </div>
                </article>
              ))
            ) : (
                <div className="surface-card-muted px-4 py-4 text-sm text-[var(--color-muted)]">
                  No reminder deliveries are staged yet.
                </div>
              )}
          </div>
        </section>

        <aside className="surface-panel px-5 py-6">
          <p className="text-sm text-[var(--color-muted)]">Queue status</p>
          <h3 className="mt-1 text-xl font-semibold text-[var(--color-ink)]">What needs attention</h3>
          <div className="mt-5 grid gap-3">
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
                <div
                  key={group.label}
                  className="surface-card px-4 py-4"
                >
                  <p className="text-sm font-medium text-[var(--color-ink)]">{group.label}</p>
                  <div className="mt-2 grid gap-2">
                    {group.tasks.length > 0 ? (
                      group.tasks.map((task) => (
                        <p key={task.id} className="text-sm text-[var(--color-muted)]">
                          {task.title} · {describeTaskTiming(task.dueDate)}
                        </p>
                      ))
                    ) : (
                      <p className="text-sm text-[var(--color-muted)]">{group.empty}</p>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
