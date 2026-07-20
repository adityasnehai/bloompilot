"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, type CSSProperties, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Badge as UiBadge } from "@/components/ui/badge";
import { Card as UiCard } from "@/components/ui/card";
import type { CarePlanAction, CarePlanOutput, CarePriority, EvidenceRef, WeatherRiskForecastDay } from "@/lib/care-plan-engine";
import type { ContextJson } from "@/lib/context-builder";
import type { PlantAlert } from "@/lib/alert-observer";
import type { ActivityEntry, CareTask } from "@/lib/garden";
import type { ReminderChannelReadiness } from "@/lib/reminders";

const Icon = {
  Sun: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" /></svg>,
  Calendar: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>,
  TrendingUp: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></svg>,
  Plant: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4"><path d="M12 21V9" /><path d="M12 14c-4.5 0-7-2.4-7-6.5 4.5 0 7 2.4 7 6.5Z" /><path d="M12 12c0-3.8 2.3-6.2 6.5-6.2 0 4.1-2.4 6.2-6.5 6.2Z" /></svg>,
  RefreshCw: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4"><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>,
  ChevronDown: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5"><polyline points="6 9 12 15 18 9" /></svg>,
  AlertTriangle: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>,
};

type Tone = "good" | "warn" | "danger" | "neutral";

function toTitle(value: string) {
  return value
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .split(" ")
    .filter(Boolean)
    .map((entry) => entry.charAt(0).toUpperCase() + entry.slice(1))
    .join(" ");
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function formatTaskDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function formatUpdatedTime(value: string, timeZone: string | null | undefined) {
  const options: Intl.DateTimeFormatOptions = {
    hour: "numeric",
    minute: "2-digit",
    // Keep the SSR and browser output identical when the garden has no timezone yet.
    timeZone: timeZone || "UTC",
  };

  try {
    return new Date(value).toLocaleTimeString("en-US", options);
  } catch {
    return new Date(value).toLocaleTimeString("en-US", {
      ...options,
      timeZone: "UTC",
    });
  }
}

function formatMetric(value: number | null | undefined, unit: string) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "No data";
  if (unit === "%") return `${Math.round(value)}%`;
  if (unit === "C") return `${Math.round(value)}°C`;
  return `${value} ${unit}`.trim();
}

function formatSourceName(value: string) {
  const key = value.trim().toLowerCase();
  if (key === "agent_reasoning" || key.includes("react care planner")) return "Care plan reasoning";
  if (key === "perenual_api") return "Perenual API";
  if (key === "perenual_api_unavailable") return "Perenual API unavailable";
  if (key === "local_rulebook_v1") return "BloomPilot care rulebook";
  if (key === "saved_location_coordinates") return "Saved garden location";
  if (key === "user_input_only") return "User-entered location";
  if (key === "open_meteo") return "Open-Meteo";
  return value;
}

function priorityTone(priority: CarePriority): Tone {
  if (priority === "high") return "danger";
  if (priority === "medium") return "warn";
  return "good";
}

function alertUrgencyLabel(urgency: PlantAlert["urgency"]) {
  return urgency === "high" ? "Do first" : "Review soon";
}

function toneStyle(tone: Tone) {
  if (tone === "good") return "dashboard-tone-good text-[var(--color-ink)]";
  if (tone === "warn") return "dashboard-tone-warn text-[var(--color-ink)]";
  if (tone === "danger") return "dashboard-tone-danger text-[var(--color-ink)]";
  return "dashboard-tone-neutral text-[var(--color-muted)]";
}

function getActiveRisks(carePlan: CarePlanOutput) {
  return Object.entries(carePlan.weather_risks)
    .filter(([key, value]) => key !== "source" && value === true)
    .map(([key]) => key === "high_uv" ? "High UV" : toTitle(key));
}

function Panel({ children, className = "", style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <UiCard style={style} className={`dashboard-panel rounded-2xl border-[var(--color-line)] bg-[var(--color-surface)] shadow-[0_2px_8px_rgba(0,0,0,0.18),0_16px_40px_rgba(0,0,0,0.18)] ${className}`}>
      {children}
    </UiCard>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">{children}</p>;
}

function StatusBadge({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  return <UiBadge variant="outline" className={`border px-2.5 py-0.5 text-[10px] ${toneStyle(tone)}`}>{children}</UiBadge>;
}

function PlantThumbnail({ imageUrl, name }: { imageUrl?: string | null; name: string }) {
  return (
    <span className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[var(--color-line)] bg-[var(--color-canvas-mint)] text-xs font-semibold text-[var(--color-canopy)]">
      {imageUrl ? (
        <Image src={imageUrl} alt={`${name} plant`} fill sizes="40px" unoptimized className="object-cover" />
      ) : (
        <span aria-hidden>{name.trim().charAt(0).toUpperCase() || "P"}</span>
      )}
    </span>
  );
}

function taskKindLabel(kind: CareTask["kind"]) {
  if (kind === "water") return "Water";
  if (kind === "feed") return "Feed";
  return "Check";
}

function actionMatchesTask(action: CarePlanAction, task: CareTask) {
  if (action.plant_id !== task.plantId) return false;
  if (action.type === "water" || action.type === "skip_water") return task.kind === "water";
  if (action.type === "fertilize") return task.kind === "feed";
  if (action.type === "inspect" || action.type === "disease_watch" || action.type === "identify") return task.kind === "inspect";
  return false;
}

function TodayLeading({
  tone,
  interactive,
  loading,
  onComplete,
  label,
}: {
  tone: Tone;
  interactive: boolean;
  loading?: boolean;
  onComplete?: () => void;
  label: string;
}) {
  const dotClass = tone === "danger" ? "dashboard-dot-danger" : tone === "warn" ? "dashboard-dot-warn" : tone === "good" ? "dashboard-dot-good" : "dashboard-dot-neutral";

  if (!interactive) {
    return (
      <span className="mt-[6px] grid h-[18px] w-[18px] shrink-0 place-items-center" aria-hidden>
        <span className={`h-[7px] w-[7px] rounded-full ${dotClass}`} />
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onComplete}
      disabled={loading}
      aria-label={`Mark ${label} done`}
      className="today-check group mt-[3px] grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border-[1.5px] border-[var(--color-line-strong)] bg-transparent transition hover:border-[var(--color-canopy)] disabled:cursor-wait disabled:opacity-50"
    >
      <span className={`h-[7px] w-[7px] rounded-full ${dotClass} opacity-0 transition group-hover:opacity-60 ${loading ? "opacity-100 animate-pulse" : ""}`} />
    </button>
  );
}

function TodayRow({
  title,
  plantName,
  plantImageUrl,
  subtitle,
  priority,
  reason,
  evidence,
  interactive,
  loading,
  error,
  onComplete,
}: {
  title: string;
  plantName: string;
  plantImageUrl?: string | null;
  subtitle: string;
  priority?: CarePriority;
  reason?: string;
  evidence?: EvidenceRef[];
  interactive: boolean;
  loading?: boolean;
  error?: boolean;
  onComplete?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const tone: Tone = priority ? priorityTone(priority) : "neutral";
  const hasReason = Boolean(reason);
  const visibleEvidence = (evidence ?? []).filter((entry) => entry.type !== "agent_reasoning" && entry.type !== "plant_context");

  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-start gap-3">
        <TodayLeading tone={tone} interactive={interactive} loading={loading} onComplete={onComplete} label={title} />
        <PlantThumbnail imageUrl={plantImageUrl} name={plantName} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--color-ink)]">{title}</p>
              <p className="mt-0.5 truncate text-xs text-[var(--color-muted)]">
                {subtitle}
                {priority === "high" ? <span className="dashboard-danger-text font-semibold"> · Do first</span> : null}
              </p>
            </div>
            {hasReason ? (
              <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                aria-expanded={open}
                className="shrink-0 pt-0.5 text-[11px] font-semibold text-[var(--color-muted)] underline decoration-dotted underline-offset-2 transition hover:text-[var(--color-ink)]"
              >
                {open ? "Hide" : "Why"}
              </button>
            ) : null}
          </div>
          {open && hasReason ? (
            <div className="mt-2 grid gap-1.5 border-t border-[var(--color-line)] pt-2">
              <p className="text-xs leading-5 text-[var(--color-muted)]">{reason}</p>
              {visibleEvidence.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {visibleEvidence.map((entry) => (
                    <span key={`${title}-${entry.type}-${entry.source}`} className="rounded-full border border-[var(--color-line)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-muted)]">
                      {formatSourceName(entry.source)}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
          {error ? <p role="alert" className="dashboard-error mt-1.5 text-[11px]">Could not save. Try again.</p> : null}
        </div>
      </div>
    </li>
  );
}

function TodayActionItem({ action, plantImageUrl }: { action: CarePlanAction; plantImageUrl?: string | null }) {
  return (
    <TodayRow
      title={action.title}
      plantName={action.plant_name || "Garden"}
      plantImageUrl={plantImageUrl}
      subtitle={`${action.plant_name || "Garden"} · ${formatDate(action.due_date)}`}
      priority={action.priority}
      reason={action.reason}
      evidence={action.evidence_refs}
      interactive={false}
    />
  );
}

function TodayTaskItem({
  task,
  plantName,
  plantImageUrl,
  evidenceReason,
  onDone,
}: {
  task: CareTask;
  plantName: string;
  plantImageUrl?: string | null;
  evidenceReason?: string;
  onDone: (taskId: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  async function markDone() {
    setLoading(true);
    setError(false);
    try {
      const response = await fetch(`/api/tasks/${encodeURIComponent(task.id)}/toggle`, { method: "POST" });
      if (!response.ok) throw new Error("Task update failed");
      onDone(task.id);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <TodayRow
      title={task.title}
      plantName={plantName}
      plantImageUrl={plantImageUrl}
      subtitle={`${plantName} · ${taskKindLabel(task.kind)}`}
      reason={evidenceReason ?? "Scheduled from your saved care plan."}
      interactive
      loading={loading}
      error={error}
      onComplete={markDone}
    />
  );
}

function TodayCare({
  actions,
  tasks,
  todayCount,
  completedToday,
  plantImages,
  plantNames,
  planActionForTask,
  onDone,
}: {
  actions: CarePlanAction[];
  tasks: CareTask[];
  todayCount: number;
  completedToday: number;
  plantImages: Map<string, string | null>;
  plantNames: Map<string, string>;
  planActionForTask: (task: CareTask) => CarePlanAction | undefined;
  onDone: (taskId: string) => void;
}) {
  const useActions = actions.length > 0;
  const visibleActions = actions.slice(0, 5);
  const visibleTasks = tasks.slice(0, 5);
  const isEmpty = useActions ? visibleActions.length === 0 : visibleTasks.length === 0;

  return (
    <Panel className="dashboard-timeline-panel p-5">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div className="flex items-baseline gap-3">
          <span className="text-3xl font-bold tabular-nums tracking-[-0.04em] text-[var(--color-ink)]">{todayCount}</span>
          <div>
            <p className="text-sm font-semibold text-[var(--color-ink)]">{todayCount === 1 ? "task for today" : "tasks for today"}</p>
            <p className="text-[11px] text-[var(--color-muted)]">{completedToday > 0 ? `${completedToday} done so far` : "Nothing closed out yet"}</p>
          </div>
        </div>
        <Link href="/tasks" className="shrink-0 text-xs font-semibold text-[var(--color-muted)] transition hover:text-[var(--color-ink)] hover:underline">All tasks →</Link>
      </div>
      {isEmpty ? (
        <p className="rounded-xl border border-[var(--color-line)] bg-[var(--color-canvas-soft)] px-4 py-5 text-sm text-[var(--color-muted)]">No care actions are due today.</p>
      ) : (
        <ol className="divide-y divide-[var(--color-line)]">
          {useActions
            ? visibleActions.map((action) => (
                <TodayActionItem key={action.id} action={action} plantImageUrl={action.plant_id ? plantImages.get(action.plant_id) : null} />
              ))
            : visibleTasks.map((task) => (
                <TodayTaskItem
                  key={task.id}
                  task={task}
                  plantName={plantNames.get(task.plantId) ?? "Plant"}
                  plantImageUrl={plantImages.get(task.plantId)}
                  evidenceReason={planActionForTask(task)?.reason}
                  onDone={onDone}
                />
              ))}
        </ol>
      )}
    </Panel>
  );
}

function DashboardTaskRow({ task, plantName, plantImageUrl, evidenceReason, onDone }: { task: CareTask; plantName: string; plantImageUrl?: string | null; evidenceReason?: string; onDone: (taskId: string) => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  async function markDone() {
    setLoading(true);
    setError(false);
    try {
      const response = await fetch(`/api/tasks/${encodeURIComponent(task.id)}/toggle`, { method: "POST" });
      if (!response.ok) throw new Error("Task update failed");
      onDone(task.id);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="dashboard-task-row rounded-xl border border-[var(--color-line)] bg-[var(--color-canvas-soft)] px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <PlantThumbnail imageUrl={plantImageUrl} name={plantName} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-xs font-semibold text-[var(--color-ink)]">{plantName}</p>
              <span className="rounded-full border border-[var(--color-line)] bg-white/60 px-2 py-0.5 text-[10px] font-semibold text-[var(--color-muted)]">{taskKindLabel(task.kind)}</span>
            </div>
            <p className="mt-1 text-sm font-semibold text-[var(--color-ink)]">{task.title}</p>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--color-muted)]">{evidenceReason ?? "Scheduled from your saved care plan."}</p>
            <p className="mt-1 text-[11px] text-[var(--color-muted)]">Due {formatTaskDate(task.dueDate)}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <button
            type="button"
            onClick={markDone}
            disabled={loading}
            className="rounded-lg bg-[var(--color-canopy)] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[var(--color-primary-hover)] disabled:cursor-wait disabled:opacity-60"
          >
            {loading ? "Saving..." : "Mark done"}
          </button>
        </div>
      </div>
      {error ? <p role="alert" className="dashboard-error mt-2 text-xs">Could not save this task. Try again.</p> : null}
    </div>
  );
}

function UpcomingCare({ tasks, plantNames }: { tasks: CareTask[]; plantNames: Map<string, string> }) {
  const visibleTasks = tasks.slice(0, 5);

  return (
    <Panel className="dashboard-upcoming-panel p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Eyebrow>Next up</Eyebrow>
          <h2 className="mt-1 text-base font-semibold text-[var(--color-ink)]">Coming this week</h2>
          <p className="mt-1 text-xs text-[var(--color-muted)]">Open care tasks scheduled for the next 7 days</p>
        </div>
        <Link href="/tasks" className="text-xs font-semibold text-[var(--color-muted)] hover:text-[var(--color-ink)] hover:underline">Open queue →</Link>
      </div>
      <div className="mt-3 grid gap-2">
        {tasks.length > 0 ? visibleTasks.map((task) => (
          <div key={task.id} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-line)] bg-white/65 px-3 py-2.5 transition hover:border-[var(--color-canopy)]/35 hover:bg-white">
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-[var(--color-ink)]">{task.title}</p>
              <p className="mt-0.5 truncate text-[11px] text-[var(--color-muted)]">{plantNames.get(task.plantId) ?? "Plant"}</p>
            </div>
            <span className="shrink-0 rounded-full border border-[var(--color-line)] bg-[var(--color-canvas-soft)] px-2 py-1 text-[10px] font-semibold text-[var(--color-muted)]">{formatTaskDate(task.dueDate)}</span>
          </div>
        )) : (
          <p className="rounded-xl border border-[var(--color-line)] bg-[var(--color-canvas-soft)] px-3 py-3 text-xs leading-5 text-[var(--color-muted)]">No open care tasks are scheduled for the next 7 days.</p>
        )}
      </div>
      {tasks.length > visibleTasks.length ? <Link href="/tasks" className="mt-3 inline-block text-xs font-semibold text-[var(--color-muted)] hover:text-[var(--color-ink)] hover:underline">View all →</Link> : null}
    </Panel>
  );
}

function ReminderStatus({ readiness }: { readiness: ReminderChannelReadiness | null }) {
  const selected = Boolean(readiness?.email || readiness?.pushSelected || readiness?.telegramSelected);
  const ready = Boolean(readiness && (readiness.email || readiness.pushReady || readiness.telegramReady));
  const blocked = [
    readiness?.pushSelected && !readiness.pushReady ? "push" : null,
    readiness?.telegramSelected && !readiness.telegramReady ? "telegram" : null,
  ].filter(Boolean);
  const rows = [
    {
      label: "Email",
      state: readiness?.email ? "Ready" : "Not selected",
      tone: readiness?.email ? "good" : "neutral",
      detail: readiness?.email ? "Sends to your account email." : "Use this if you want email reminders.",
    },
    {
      label: "Browser push",
      state: !readiness?.pushSelected ? "Not selected" : readiness.pushReady ? "Ready" : "Needs setup",
      tone: !readiness?.pushSelected ? "neutral" : readiness.pushReady ? "good" : "warn",
      detail: !readiness?.pushSelected
        ? "Enable it if you want browser notifications."
        : readiness.pushReady
          ? "Subscribed on this browser."
          : "Selected, but this browser is not subscribed yet.",
    },
    {
      label: "Telegram",
      state: !readiness?.telegramSelected ? "Not selected" : readiness.telegramReady ? "Ready" : "Needs setup",
      tone: !readiness?.telegramSelected ? "neutral" : readiness.telegramReady ? "good" : "warn",
      detail: !readiness?.telegramSelected
        ? "Connect the BloomPilot bot when you need Telegram."
        : readiness.telegramReady
          ? "Connected to your Telegram bot chat."
          : "Selected, but Telegram is not connected yet.",
    },
  ] as const;

  return (
    <Panel className="dashboard-reminder-panel p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Eyebrow>Reminders</Eyebrow>
          <h2 className="mt-1 text-base font-semibold text-[var(--color-ink)]">Channel readiness</h2>
        </div>
        <StatusBadge tone={ready ? "good" : "warn"}>{ready ? "Ready" : "Needs setup"}</StatusBadge>
      </div>
      <p className="mt-2 text-xs leading-5 text-[var(--color-muted)]">
        {ready ? "At least one selected channel can send reminders now." : selected ? `${blocked.length || 1} selected channel${blocked.length === 1 ? "" : "s"} still need setup.` : "Select a channel in Settings to enable reminders."}
      </p>
      <div className="mt-3 grid gap-2">
        {rows.map((row) => (
          <div key={row.label} className="rounded-xl border border-[var(--color-line)] bg-[var(--color-canvas-soft)] px-3 py-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[var(--color-ink)]">{row.label}</p>
                <p className="mt-1 text-xs leading-5 text-[var(--color-muted)]">{row.detail}</p>
              </div>
              <StatusBadge tone={row.tone === "good" ? "good" : row.tone === "warn" ? "warn" : "neutral"}>{row.state}</StatusBadge>
            </div>
          </div>
        ))}
      </div>
      {!ready ? <Link href="/settings" className="mt-3 inline-block text-xs font-semibold text-[var(--color-muted)] hover:text-[var(--color-ink)] hover:underline">Manage reminders →</Link> : null}
    </Panel>
  );
}

function RiskTile({ date, count }: { date: string; count: number }) {
  const toneClass = count > 0 ? "dashboard-risk-active text-[var(--color-ink)]" : "border-[var(--color-line)] bg-white/60 text-[var(--color-ink)]";
  return (
    <div aria-label={`${formatDate(date)}: ${count} weather risk signal${count === 1 ? "" : "s"}`} className={`rounded-xl border p-2 text-center ${toneClass}`}>
      <p className="text-[9px] font-bold">{formatDate(date)}</p>
      <p className="mt-0.5 text-lg font-bold">{count}</p>
      <p className="text-[8px]">risk</p>
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
  icon,
  meaning,
  gradient,
  backgroundImage,
}: {
  label: string;
  value: string;
  detail: string;
  icon: ReactNode;
  meaning: string;
  gradient: "mint" | "sage" | "meadow" | "mist";
  backgroundImage?: string;
}) {
  return (
    <Panel
      className={`dashboard-metric-card dashboard-metric-gradient-${gradient} relative overflow-hidden rounded-xl p-4 shadow-[0_4px_14px_rgba(20,52,39,0.04)]`}
      style={backgroundImage ? { backgroundImage: `linear-gradient(135deg, rgba(255,255,255,0.82), rgba(255,255,255,0.72)), url('${backgroundImage}')`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
    >
      {backgroundImage ? <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_14%_10%,rgba(255,255,255,0.22),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.18),rgba(255,255,255,0.06))]" /> : null}
      <div className="relative z-10">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[11px] font-semibold text-[var(--color-muted)]">{label}</p>
          <div className="group relative">
            <span
              tabIndex={0}
              aria-label={`${label}: ${meaning}`}
              className="inline-flex h-7 w-7 cursor-help items-center justify-center rounded-lg border border-[var(--color-line)] bg-white/65 text-[var(--color-canopy)] outline-none transition hover:border-[var(--color-canopy)]/45 hover:bg-white focus-visible:ring-2 focus-visible:ring-[var(--color-canopy)]/30"
            >
              {icon}
            </span>
            <span
              role="tooltip"
              className="pointer-events-none absolute right-0 top-full z-30 mt-2 w-52 rounded-lg border border-[var(--color-line-strong)] bg-white px-3 py-2 text-[11px] leading-4 text-[var(--color-ink-muted)] opacity-0 shadow-[0_10px_24px_rgba(24,36,27,0.12)] transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
            >
              {meaning}
            </span>
          </div>
        </div>
        <p className="mt-3 text-3xl font-bold tracking-[-0.05em] text-[var(--color-ink)] lg:text-[2.15rem]">{value}</p>
        <p className="mt-1 text-[10px] text-[var(--color-muted)]">{detail}</p>
      </div>
    </Panel>
  );
}

function CareLoadStrip({
  tasks,
  completionRate,
  completed,
  due,
  forecast,
}: {
  tasks: CareTask[];
  completionRate: number;
  completed: number;
  due: number;
  forecast: WeatherRiskForecastDay[];
}) {
  const counts = new Map<string, number>();
  tasks.forEach((task) => counts.set(task.dueDate.slice(0, 10), (counts.get(task.dueDate.slice(0, 10)) ?? 0) + 1));
  const days = forecast.slice(0, 7);
  const safeRate = Math.min(100, Math.max(0, Math.round(completionRate)));

  return (
    <Panel className="dashboard-calendar-panel p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Eyebrow>Care calendar</Eyebrow>
          <h2 className="mt-1 text-base font-semibold text-[var(--color-ink)]">This week</h2>
          <p className="mt-1 text-xs text-[var(--color-muted)]">Scheduled care for the next seven days</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold text-[var(--color-ink)]">{safeRate}%</p>
          <p className="text-[10px] text-[var(--color-muted)]">follow-through</p>
        </div>
      </div>
      {days.length > 0 ? (
        <div className="mt-4 grid grid-cols-7 gap-2" aria-label="Care calendar for the next seven days">
          {days.map((day, index) => {
            const count = counts.get(day.date) ?? 0;
            const date = new Date(`${day.date}T00:00:00Z`);
            return (
              <div
                key={day.date}
                className={`min-w-0 rounded-xl border px-2 py-2 text-center transition ${
                  index === 0
                    ? "dashboard-today border-[rgba(126,226,170,0.6)] shadow-[0_6px_18px_rgba(24,36,27,0.06)]"
                    : "border-[var(--color-line)] bg-white/70"
                }`}
              >
                <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-[var(--color-muted)]">
                  {date.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" })}
                </p>
                <p className="mt-1 text-sm font-bold text-[var(--color-ink)]">{date.getUTCDate()}</p>
                <div className="mt-2 flex min-h-7 items-center justify-center">
                  {count > 0 ? (
                    <span className="dashboard-task-count inline-flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-[9px] font-bold leading-none">
                      {count} task{count === 1 ? "" : "s"}
                    </span>
                  ) : (
                    <span className="rounded-full border border-[var(--color-line)] bg-white/70 px-2.5 py-1 text-[9px] font-semibold text-[var(--color-muted)]">
                      No task
                    </span>
                  )}
                </div>
              </div>
          );
          })}
        </div>
      ) : (
        <p className="mt-4 rounded-xl border border-[var(--color-line)] bg-[var(--color-canvas-soft)] px-3 py-3 text-xs leading-5 text-[var(--color-muted)]">
          {forecast.length === 0 ? "The forecast is unavailable. Open the care queue for scheduled tasks." : "No upcoming care is scheduled yet."}
        </p>
      )}
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-[var(--color-line)] pt-3 text-[10px] text-[var(--color-muted)]">
        <span>{completed} of {due} complete</span>
        <Link href="/tasks" className="font-semibold text-[var(--color-muted)] hover:text-[var(--color-ink)] hover:underline">Open care queue →</Link>
      </div>
    </Panel>
  );
}

function CareProgressChart({ tasks, anchor }: { tasks: CareTask[]; anchor: string }) {
  const anchorDate = new Date(anchor);
  const dates = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(anchorDate);
    date.setUTCDate(date.getUTCDate() - (6 - index));
    return date.toISOString().slice(0, 10);
  });
  const counts = new Map(dates.map((date) => [date, { due: 0, done: 0 }]));

  tasks.forEach((task) => {
    const parsedDate = new Date(task.dueDate);
    if (Number.isNaN(parsedDate.getTime())) return;
    const date = parsedDate.toISOString().slice(0, 10);
    const point = counts.get(date);
    if (!point) return;
    point.due += 1;
    if (task.status === "done") point.done += 1;
  });

  const max = Math.max(...Array.from(counts.values()).map((point) => point.due), 1);
  const hasData = Array.from(counts.values()).some((point) => point.due > 0);
  const totalDue = Array.from(counts.values()).reduce((sum, point) => sum + point.due, 0);
  const totalDone = Array.from(counts.values()).reduce((sum, point) => sum + point.done, 0);
  const completionRate = totalDue > 0 ? Math.round((totalDone / totalDue) * 100) : 0;

  return (
    <Panel className="dashboard-progress-panel p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Eyebrow>Care progress</Eyebrow>
          <h2 className="mt-1 text-base font-semibold text-[var(--color-ink)]">Your care rhythm</h2>
          <p className="mt-1 text-xs text-[var(--color-muted)]">Completed care against scheduled work</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold text-[var(--color-ink)]">{completionRate}%</p>
          <p className="text-[10px] text-[var(--color-muted)]">follow-through</p>
        </div>
      </div>
      {hasData ? (
        <>
          <div className="mt-4 flex items-center gap-3 text-[10px] text-[var(--color-muted)]">
            <span className="inline-flex items-center gap-1.5"><span className="dashboard-chart-track h-2 w-2 rounded-sm" />Scheduled</span>
            <span className="inline-flex items-center gap-1.5"><span className="dashboard-chart-done h-2 w-2 rounded-sm" />Completed</span>
          </div>
          <div className="mt-3 grid h-36 grid-cols-7 items-end gap-2" aria-label="Scheduled and completed care over the last seven days">
            {dates.map((date) => {
              const point = counts.get(date)!;
              const day = new Date(`${date}T00:00:00Z`);
              const dueHeight = point.due > 0 ? Math.max(12, Math.round((point.due / max) * 104)) : 0;
              const doneHeight = point.done > 0 ? Math.max(8, Math.round((point.done / max) * 104)) : 0;
              const donePct = point.due > 0 ? Math.round((point.done / point.due) * 100) : 0;

              return (
                <div key={date} className="flex h-full min-w-0 flex-col items-center justify-end gap-1">
                  <div className="flex h-[104px] w-full max-w-10 items-end justify-center" title={`${point.done} done, ${point.due} scheduled on ${formatDate(date)}`}>
                    <div className="relative flex h-full w-full items-end justify-center overflow-hidden rounded-t-md bg-[var(--color-canvas-soft)]">
                      <div
                        className="absolute inset-x-0 bottom-0 rounded-t-md bg-[var(--color-canopy)]/22"
                        style={{ height: `${dueHeight}px` }}
                      />
                      {point.done > 0 ? (
                        <div
                          className="absolute inset-x-0 bottom-0 rounded-t-md bg-[var(--color-canopy)] shadow-[0_0_0_1px_rgba(79,139,77,0.15)]"
                          style={{ height: `${doneHeight}px` }}
                        />
                      ) : null}
                      {point.due === 0 ? <span className="mb-2 text-[8px] font-semibold text-[var(--color-muted)]">—</span> : null}
                    </div>
                  </div>
                  <p className="text-[9px] font-semibold text-[var(--color-ink)]">{day.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" })}</p>
                  <p className="text-[9px] text-[var(--color-muted)]">{point.done}/{point.due}{point.due > 0 ? ` · ${donePct}%` : ""}</p>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <p className="mt-5 rounded-lg border border-[var(--color-line)] bg-[var(--color-canvas-soft)] px-3 py-3 text-xs leading-5 text-[var(--color-muted)]">Your care history will appear here after the first scheduled action.</p>
      )}
      <div className="mt-4 border-t border-[var(--color-line)] pt-3">
        <Link href="/tasks" className="text-xs font-semibold text-[var(--color-muted)] hover:text-[var(--color-ink)] hover:underline">Open care history →</Link>
      </div>
    </Panel>
  );
}

function PlantStatusBoard({
  plans,
  adherence,
  alerts,
}: {
  plans: CarePlanOutput["plant_plans"];
  adherence: CarePlanOutput["care_adherence"]["by_plant"];
  alerts: PlantAlert[];
}) {
  const alertMap = new Map(alerts.map((alert) => [alert.plantId, alert]));
  const adherenceMap = new Map(adherence.map((entry) => [entry.plant_id, entry]));
  const groups = {
    needs: [] as CarePlanOutput["plant_plans"],
    monitor: [] as CarePlanOutput["plant_plans"],
    onTrack: [] as CarePlanOutput["plant_plans"],
  };

  function classifyPlant(plan: CarePlanOutput["plant_plans"][number]) {
    const alert = alertMap.get(plan.plant_id);
    const plantAdherence = adherenceMap.get(plan.plant_id);
    const due = plantAdherence?.due ?? 0;
    const completionRate = plantAdherence?.completion_rate ?? 100;

    if (plan.readiness !== "ready") {
      return { group: "needs" as const, note: "Setup incomplete" };
    }
    if (alert?.urgency === "high") {
      return { group: "needs" as const, note: alert.message };
    }
    if (alert || (due > 0 && completionRate < 70)) {
      return { group: "monitor" as const, note: alert?.message ?? `${completionRate}% complete` };
    }
    return { group: "onTrack" as const, note: "No active signals" };
  }

  plans.forEach((plan) => {
    const bucket = classifyPlant(plan);
    groups[bucket.group].push(plan);
  });

  const columns = [
    { key: "needs", label: "Needs action", tone: "danger" as Tone, items: groups.needs },
    { key: "monitor", label: "Monitor", tone: "warn" as Tone, items: groups.monitor },
    { key: "onTrack", label: "On track", tone: "good" as Tone, items: groups.onTrack },
  ];

  return (
    <Panel className="dashboard-status-panel p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Eyebrow>Plant status</Eyebrow>
          <h2 className="mt-1 text-base font-semibold text-[var(--color-ink)]">Current plant state</h2>
          <p className="mt-1 text-xs text-[var(--color-muted)]">Plants grouped by setup, attention, and stability</p>
        </div>
        <Link href="/garden" className="text-xs font-semibold text-[var(--color-muted)] hover:text-[var(--color-ink)] hover:underline">View garden →</Link>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {columns.map((column) => (
          <div key={column.key} className="rounded-lg border border-[var(--color-line)] bg-[var(--color-canvas-soft)]/45 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-bold text-[var(--color-ink)]">{column.label}</p>
              <StatusBadge tone={column.tone}>{column.items.length}</StatusBadge>
            </div>
            <div className="mt-2 grid gap-1.5">
              {column.items.length > 0 ? column.items.slice(0, 4).map((plant) => {
                const bucket = classifyPlant(plant);
                return (
                  <Link key={plant.plant_id} href={`/garden/${encodeURIComponent(plant.plant_id)}`} className="rounded-lg border border-[var(--color-line)] bg-white/65 px-2.5 py-2 transition hover:border-[var(--color-canopy)]/35 hover:bg-white">
                    <p className="truncate text-xs font-semibold text-[var(--color-ink)]">{plant.plant_name}</p>
                    <p className="mt-0.5 truncate text-[10px] text-[var(--color-muted)]">
                      {bucket.note}
                    </p>
                  </Link>
                );
              }) : <p className="py-2 text-[10px] text-[var(--color-muted)]">None right now.</p>}
              {column.items.length > 4 ? <Link href="/garden" className="px-1 text-[10px] font-semibold text-[var(--color-muted)] hover:text-[var(--color-ink)]">View all {column.items.length} →</Link> : null}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function RecentActivity({ activities }: { activities: ActivityEntry[] }) {
  return (
    <Panel className="dashboard-activity-panel p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Eyebrow>Recent activity</Eyebrow>
          <h2 className="mt-1 text-base font-semibold text-[var(--color-ink)]">What changed</h2>
          <p className="mt-1 text-xs text-[var(--color-muted)]">Latest plant, care, and setup updates</p>
        </div>
        <Link href="/history" className="text-xs font-semibold text-[var(--color-muted)] hover:text-[var(--color-ink)] hover:underline">View history →</Link>
      </div>
      {activities.length > 0 ? (
        <div className="mt-3 divide-y divide-[var(--color-line)]">
          {activities.slice(0, 5).map((activity) => (
            <div key={activity.id} className="flex items-start gap-3 py-3 first:pt-1 last:pb-0">
              <span className="dashboard-activity-dot mt-1.5 h-2 w-2 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-[var(--color-ink)]">{activity.title}</p>
                <p className="mt-0.5 truncate text-[11px] text-[var(--color-muted)]">{activity.detail}</p>
              </div>
              <time dateTime={activity.createdAt} className="shrink-0 text-[10px] text-[var(--color-muted)]">
                {new Date(activity.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}
              </time>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 rounded-lg border border-[var(--color-line)] bg-[var(--color-canvas-soft)] px-3 py-3 text-xs text-[var(--color-muted)]">Recent plant and care updates will appear here.</p>
      )}
    </Panel>
  );
}

function AlertRow({ alert }: { alert: PlantAlert }) {
  const tone = alert.urgency === "high" ? "danger" : "warn";
  return (
    <Link
      href={`/garden/${encodeURIComponent(alert.plantId)}`}
      className={`block rounded-xl border px-3.5 py-3 transition hover:-translate-y-0.5 hover:shadow-sm ${toneStyle(tone)}`}
    >
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 shrink-0"><Icon.AlertTriangle /></span>
        <div className="min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-semibold">{alert.plantName}</p>
            <span className="shrink-0 text-[10px] font-bold tracking-[0.08em]">{alertUrgencyLabel(alert.urgency)}</span>
          </div>
          <p className="mt-1 text-xs leading-5 opacity-85">{alert.message}</p>
        </div>
      </div>
    </Link>
  );
}

function DashboardOverview({
  context,
  carePlan,
  alerts,
  overdueTasks,
  dueTodayTasks,
  upcomingTasks,
  allTasks,
  activities,
  reminderReadiness,
}: {
  context: ContextJson;
  carePlan: CarePlanOutput;
  alerts: PlantAlert[];
  overdueTasks: CareTask[];
  dueTodayTasks: CareTask[];
  upcomingTasks: CareTask[];
  allTasks: CareTask[];
  activities: ActivityEntry[];
  reminderReadiness: ReminderChannelReadiness | null;
}) {
  const router = useRouter();
  const [completedTaskIds, setCompletedTaskIds] = useState<Set<string>>(new Set());
  const activeRisks = getActiveRisks(carePlan);
  const totalPlants = carePlan.plant_plans.length;
  const readyPlants = carePlan.plant_plans.filter((plant) => plant.readiness === "ready").length;
  const humidity = context.environment.humidity_percent;
  const weatherAvailable = [
    context.environment.temperature_c,
    context.environment.humidity_percent,
    context.environment.rainfall_mm,
    context.environment.uv_index,
  ].some((value) => typeof value === "number" && Number.isFinite(value));
  const weatherLine = weatherAvailable
    ? [
        context.environment.temperature_c !== null ? `Temperature ${formatMetric(context.environment.temperature_c, "C")}` : null,
        humidity !== null ? `Humidity ${formatMetric(humidity, "%")}` : null,
        context.environment.rainfall_mm !== null ? `Rain ${context.environment.rainfall_mm} mm` : null,
        context.environment.uv_index !== null ? `UV ${context.environment.uv_index}` : null,
      ].filter(Boolean).join(" · ")
    : "Weather data is currently unavailable.";
  const visibleOverdueTasks = overdueTasks.filter((task) => !completedTaskIds.has(task.id));
  const visibleTodayTasks = dueTodayTasks.filter((task) => !completedTaskIds.has(task.id));
  const visibleUpcomingTasks = upcomingTasks.filter((task) => !completedTaskIds.has(task.id));
  const careLoadTasks = [...visibleTodayTasks, ...visibleUpcomingTasks];
  const todayCount = carePlan.today_actions.length > 0 ? carePlan.today_actions.length : visibleTodayTasks.length;
  const plantNames = new Map(context.plants.map((plant) => [plant.plant_id, plant.common_name]));
  const plantImages = new Map(context.plants.map((plant) => [plant.plant_id, plant.image_url]));
  const planActionForTask = (task: CareTask) => {
    const exactTitle = carePlan.today_actions.find(
      (action) => action.plant_id === task.plantId && action.title === task.title,
    );
    return exactTitle ?? carePlan.today_actions.find((action) => actionMatchesTask(action, task));
  };
  const markTaskDone = (taskId: string) => {
    setCompletedTaskIds((current) => new Set(current).add(taskId));
    // Refresh server-derived counts and the next care queue after persistence succeeds.
    router.refresh();
  };
  const decisionText = activeRisks.includes("Heavy Rain")
    ? "Delay watering where rain is expected."
    : activeRisks.includes("Humidity Stress") && humidity !== null && humidity >= 85
      ? "Humidity is high. Check leaves and soil before watering."
      : activeRisks.includes("Humidity Stress")
        ? "Humidity is low. Check exposed plants and soil moisture."
    : activeRisks.includes("Heat Stress") || activeRisks.includes("High Uv")
      ? "Check exposed plants before the hottest part of the day."
      : "No weather change requires a different care routine today.";

  return (
    <div className="grid gap-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Due today"
          value={`${todayCount}`}
          detail={todayCount === 1 ? "care action to complete" : "care actions to complete"}
          icon={<Icon.Calendar />}
          meaning="Care actions scheduled for today."
          gradient="mint"
          backgroundImage="/due-today-card.png"
        />
        <MetricCard
          label="This week"
          value={carePlan.care_adherence.weekly_due > 0 ? `${Math.round(carePlan.care_adherence.weekly_completion_rate)}%` : "—"}
          detail={carePlan.care_adherence.weekly_due > 0 ? `${carePlan.care_adherence.weekly_completed} of ${carePlan.care_adherence.weekly_due} tasks completed` : "No scheduled tasks yet"}
          icon={<Icon.TrendingUp />}
          meaning="Scheduled care completed during the current week."
          gradient="sage"
        />
        <MetricCard
          label="Plants ready"
          value={`${readyPlants}/${totalPlants}`}
          detail={totalPlants === 0 ? "add a plant to begin" : "ready for tailored care"}
          icon={<Icon.Plant />}
          meaning="Plants with enough context for tailored care."
          gradient="meadow"
        />
        <MetricCard
          label="Weather signals"
          value={`${activeRisks.length}`}
          detail={activeRisks.length > 0 ? "may change today's routine" : "no active risk today"}
          icon={<Icon.Sun />}
          meaning="Current weather conditions that may change care today."
          gradient="mist"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="grid content-start gap-4">
          {visibleOverdueTasks.length > 0 ? (
            <Panel className="border-white/14 bg-white/5 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Eyebrow>Overdue</Eyebrow>
                  <h2 className="dashboard-danger-text mt-1 text-base font-semibold">Fix these first</h2>
                </div>
                <StatusBadge tone="danger">{visibleOverdueTasks.length} overdue</StatusBadge>
              </div>
              <div className="mt-3 grid gap-2">
                {visibleOverdueTasks.slice(0, 3).map((task) => (
                  <DashboardTaskRow
                    key={task.id}
                    task={task}
                    plantName={plantNames.get(task.plantId) ?? "Plant"}
                    plantImageUrl={plantImages.get(task.plantId)}
                    evidenceReason={planActionForTask(task)?.reason}
                    onDone={markTaskDone}
                  />
                ))}
              </div>
              {visibleOverdueTasks.length > 3 ? <Link href="/tasks" className="dashboard-danger-text mt-3 inline-block text-xs font-semibold hover:underline">Open all overdue tasks →</Link> : null}
            </Panel>
          ) : null}
          <TodayCare
            actions={carePlan.today_actions}
            tasks={visibleTodayTasks}
            todayCount={todayCount}
            completedToday={dueTodayTasks.filter((task) => completedTaskIds.has(task.id)).length}
            plantImages={plantImages}
            plantNames={plantNames}
            planActionForTask={planActionForTask}
            onDone={markTaskDone}
          />
        </div>
        <CareProgressChart tasks={allTasks} anchor={carePlan.generated_at} />
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Panel className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Eyebrow>Attention</Eyebrow>
              <h2 className="mt-1 text-base font-semibold text-[var(--color-ink)]">What needs a check</h2>
              <p className="mt-1 text-xs text-[var(--color-muted)]">Only active plant issues are shown here.</p>
            </div>
            {alerts.length > 0 ? <StatusBadge tone="danger">{alerts.length} active</StatusBadge> : null}
          </div>
          <div className="mt-3 grid gap-2">
            {alerts.length > 0 ? alerts.slice(0, 3).map((alert) => <AlertRow key={alert.id} alert={alert} />) : (
              <p className="rounded-xl border border-[var(--color-line)] bg-[var(--color-canvas-soft)] px-3.5 py-3 text-xs leading-5 text-[var(--color-muted)]">
                No active issues right now. Your garden is steady and ready for the next check.
              </p>
            )}
          </div>
          {alerts.length > 3 ? <Link href="/diagnosis" className="mt-3 inline-block text-xs font-semibold text-[var(--color-muted)] hover:text-[var(--color-ink)] hover:underline">Review all issues →</Link> : null}
        </Panel>

        <Panel className="p-5">
          <Eyebrow>Weather impact</Eyebrow>
          <h2 className="mt-1 text-base font-semibold text-[var(--color-ink)]">What changes today</h2>
          <p className="mt-1 text-xs text-[var(--color-muted)]">BloomPilot uses these conditions to adjust care.</p>
          <div className="mt-4 rounded-xl border border-[var(--color-line)] bg-[var(--color-canvas-soft)] p-3">
            <p className="text-sm font-semibold leading-5 text-[var(--color-ink)]">{weatherAvailable ? decisionText : "Weather guidance is unavailable right now."}</p>
            <p className="mt-1 text-[11px] leading-5 text-[var(--color-muted)]">{weatherLine}</p>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {activeRisks.length > 0 ? activeRisks.slice(0, 3).map((risk) => <StatusBadge key={risk} tone="warn">{risk}</StatusBadge>) : null}
          </div>
        </Panel>
      </div>

      <CareLoadStrip
        tasks={careLoadTasks}
        completionRate={carePlan.care_adherence.weekly_completion_rate}
        completed={carePlan.care_adherence.weekly_completed}
        due={carePlan.care_adherence.weekly_due}
        forecast={carePlan.weather_risk_forecast}
      />

      <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <PlantStatusBoard plans={carePlan.plant_plans} adherence={carePlan.care_adherence.by_plant} alerts={alerts} />
        <UpcomingCare tasks={visibleUpcomingTasks} plantNames={plantNames} />
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Panel className="dashboard-weather-outlook-panel p-5">
          <Eyebrow>Weather outlook</Eyebrow>
          <h2 className="mt-1 text-base font-semibold text-[var(--color-ink)]">7-day outlook</h2>
          <p className="mt-1 text-xs text-[var(--color-muted)]">Weather signals that may change care this week</p>
          {carePlan.weather_risk_forecast.length > 0 ? (
            <div className="mt-3 grid grid-cols-7 gap-1.5">
              {carePlan.weather_risk_forecast.slice(0, 7).map((day) => <RiskTile key={day.date} date={day.date} count={day.risk_count} />)}
            </div>
          ) : <p className="mt-3 rounded-xl border border-[var(--color-line)] bg-[var(--color-canvas-soft)] px-3 py-3 text-xs text-[var(--color-muted)]">No forecast is available right now.</p>}
        </Panel>
        <ReminderStatus readiness={reminderReadiness} />
      </div>

      <RecentActivity activities={activities} />
    </div>
  );
}

export function CareDashboardView({
  context,
  carePlan,
  alerts,
  overdueTasks,
  dueTodayTasks,
  upcomingTasks,
  allTasks,
  activities,
  reminderReadiness,
}: {
  context: ContextJson;
  carePlan: CarePlanOutput;
  alerts: PlantAlert[];
  overdueTasks: CareTask[];
  dueTodayTasks: CareTask[];
  upcomingTasks: CareTask[];
  allTasks: CareTask[];
  activities: ActivityEntry[];
  reminderReadiness: ReminderChannelReadiness | null;
}) {
  const visibleAlerts = alerts.filter((alert) => alert.urgency === "high" || alert.urgency === "medium");
  const hasOpenIssues = visibleAlerts.length > 0 || overdueTasks.length > 0;

  return (
    <div className="dashboard-view grid gap-5 animate-fade-rise">
      <section className="border-b border-[var(--color-line)] pb-5">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">Overview</p>
            <h1 className="mt-1.5 text-2xl font-bold tracking-[-0.04em] text-[var(--color-ink)] text-balance lg:text-3xl">
              {context.user.name ? `${context.user.name}'s garden` : "Garden overview"}
            </h1>
            <p className="mt-1.5 max-w-3xl text-xs leading-5 text-[var(--color-muted)] text-balance">
              {context.garden.location.input || "Your garden"} · {context.garden.garden_type || "Garden setup"} · Updated {formatUpdatedTime(context.generated_at, context.garden.location.timezone)}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:pt-4">
            {hasOpenIssues ? (
              <StatusBadge tone="danger">{visibleAlerts.length > 0 ? `${visibleAlerts.length} active ${visibleAlerts.length === 1 ? "alert" : "alerts"}` : `${overdueTasks.length} overdue`}</StatusBadge>
            ) : null}
          </div>
        </div>
      </section>

      <DashboardOverview
        context={context}
        carePlan={carePlan}
        alerts={visibleAlerts}
        overdueTasks={overdueTasks}
        dueTodayTasks={dueTodayTasks}
        upcomingTasks={upcomingTasks}
        allTasks={allTasks}
        activities={activities}
        reminderReadiness={reminderReadiness}
      />

    </div>
  );
}
