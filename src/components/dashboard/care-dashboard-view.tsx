"use client";

import Link from "next/link";
import { useState, useEffect, type ReactNode } from "react";
import type { HealthEvent } from "@/lib/plant-memory";
import type {
  AgentTrace,
  CarePlanAction,
  CarePlanOutput,
  CarePriority,
  PlantCarePlan,
} from "@/lib/care-plan-engine";
import type { ContextJson } from "@/lib/context-builder";
import type { PlantAlert } from "@/lib/alert-observer";

const Icon = {
  Leaf: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4"><path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z" /><path d="M12 22V12" /></svg>,
  Droplet: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-2.1-5.6L12 2 7.1 9.4C6 11.1 5 13 5 15a7 7 0 0 0 7 7z" /></svg>,
  Sun: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" /></svg>,
  Wind: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4"><path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2" /><path d="M9.6 4.6A2 2 0 1 1 11 8H2" /><path d="M12.6 19.4A2 2 0 1 0 14 16H2" /></svg>,
  AlertTriangle: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>,
  CheckCircle: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>,
  TrendingUp: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></svg>,
  Calendar: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>,
  Activity: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>,
  BarChart: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /><line x1="2" y1="20" x2="22" y2="20" /></svg>,
  Grid: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>,
  RefreshCw: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4"><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>,
  ChevronDown: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5"><polyline points="6 9 12 15 18 9" /></svg>,
  Thermometer: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" /></svg>,
  Bell: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>,
  Zap: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>,
};

type Tab = "overview" | "plants" | "forecast" | "activity" | "analytics";
type Tone = "good" | "warn" | "danger" | "neutral";

const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
  { id: "overview", label: "Overview", icon: <Icon.Grid /> },
  { id: "plants", label: "Plants", icon: <Icon.Leaf /> },
  { id: "forecast", label: "Forecast", icon: <Icon.Calendar /> },
  { id: "activity", label: "Activity", icon: <Icon.Activity /> },
  { id: "analytics", label: "Analytics", icon: <Icon.BarChart /> },
];

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

function formatLongDate(value: string) {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

function formatMetric(value: number | null | undefined, unit: string) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "No data";
  return unit === "%" ? `${value}%` : `${value} ${unit}`.trim();
}

function formatSourceName(value: string) {
  const key = value.trim().toLowerCase();
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

function toneStyle(tone: Tone) {
  if (tone === "good") return "bg-emerald-50 border-emerald-200 text-emerald-700";
  if (tone === "warn") return "bg-amber-50 border-amber-200 text-amber-700";
  if (tone === "danger") return "bg-red-50 border-red-200 text-red-700";
  return "bg-[var(--color-canvas)] border-[var(--color-line)] text-[var(--color-muted)]";
}

function healthGrad(value: number) {
  if (value >= 80) return "from-emerald-400 to-emerald-500";
  if (value >= 60) return "from-amber-400 to-amber-500";
  return "from-red-400 to-red-500";
}

function healthText(value: number) {
  if (value >= 80) return "text-emerald-600";
  if (value >= 60) return "text-amber-600";
  return "text-red-500";
}

function getPlantColor(index: number) {
  return ["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#06b6d4", "#ef4444"][index % 6];
}

function getActiveRisks(carePlan: CarePlanOutput) {
  return Object.entries(carePlan.weather_risks)
    .filter(([key, value]) => key !== "source" && value === true)
    .map(([key]) => toTitle(key));
}

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-[var(--color-line)] bg-white shadow-[0_2px_8px_rgba(20,52,39,0.06),0_16px_40px_rgba(20,52,39,0.04)] ${className}`}>
      {children}
    </div>
  );
}

function Card({ children, className = "", onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div onClick={onClick} className={`rounded-xl border border-[var(--color-line)] bg-white shadow-[0_1px_3px_rgba(20,52,39,0.06)] ${onClick ? "cursor-pointer" : ""} ${className}`}>
      {children}
    </div>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">{children}</p>;
}

function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${toneStyle(tone)}`}>{children}</span>;
}

function MiniBar({ value, grad }: { value: number; grad: string }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
      <div className={`h-full rounded-full bg-gradient-to-r ${grad}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

function Ring({ value, size = 76 }: { value: number; size?: number }) {
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (value / 100) * circumference;
  const hue = value >= 80 ? "#10b981" : value >= 60 ? "#f59e0b" : "#ef4444";

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(20,52,39,0.07)" strokeWidth={10} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={hue}
        strokeWidth={10}
        strokeDasharray={`${dash} ${circumference}`}
        strokeLinecap="round"
      />
    </svg>
  );
}

function StatCard({ label, value, detail, icon, accentClass }: {
  label: string;
  value: string | number;
  detail: string;
  icon: ReactNode;
  accentClass: string;
}) {
  return (
    <Card className="relative overflow-hidden px-4 py-4 transition-shadow hover:shadow-lg">
      <span className={`absolute inset-x-0 top-0 h-0.5 rounded-t-xl bg-gradient-to-r ${accentClass}`} />
      <div className="mb-2 flex items-center justify-between">
        <Eyebrow>{label}</Eyebrow>
        <span className={`flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br ${accentClass} text-white shadow-sm`}>
          {icon}
        </span>
      </div>
      <p className="text-2xl font-bold leading-none text-[var(--color-ink)]">{value}</p>
      <p className="mt-1.5 text-xs text-[var(--color-muted)]">{detail}</p>
    </Card>
  );
}

function StatusPill({ readiness }: { readiness: PlantCarePlan["readiness"] }) {
  if (readiness === "ready") {
    return <Badge tone="good">Ready</Badge>;
  }
  if (readiness === "needs_care_data") {
    return <Badge tone="warn">Care data</Badge>;
  }
  return <Badge tone="warn">Needs ID</Badge>;
}

function ActionRow({ action }: { action: CarePlanAction }) {
  const [open, setOpen] = useState(false);
  const tone = priorityTone(action.priority);

  return (
    <button
      type="button"
      onClick={() => setOpen((value) => !value)}
      className={`w-full rounded-xl border px-4 py-3 text-left transition-all hover:shadow-md ${toneStyle(tone)} ${open ? "shadow-md" : ""}`}
    >
      <div className="flex items-start gap-3">
        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${tone === "danger" ? "bg-red-500" : tone === "warn" ? "bg-amber-400" : "bg-emerald-400"}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">{action.title}</p>
            <div className="flex shrink-0 items-center gap-2">
              <span className="rounded-full border border-current/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                {toTitle(action.priority)}
              </span>
              <span className={`transition-transform ${open ? "rotate-180" : ""}`}>
                <Icon.ChevronDown />
              </span>
            </div>
          </div>
          <p className="mt-0.5 text-xs opacity-75">
            {action.plant_name || "Garden"} · {formatDate(action.due_date)}
          </p>
          {open ? (
            <div className="mt-2.5 grid gap-2 border-t border-current/15 pt-2.5">
              <p className="text-xs leading-5 opacity-85">{action.reason}</p>
              <div className="flex flex-wrap gap-1.5">
                {action.evidence_refs.map((entry) => (
                  <span key={`${action.id}-${entry.type}-${entry.source}`} className="rounded-full border border-current/15 px-2 py-0.5 text-[10px] font-semibold opacity-80">
                    {formatSourceName(entry.source)}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </button>
  );
}

function AgentTraceRow({ trace }: { trace: AgentTrace }) {
  const [open, setOpen] = useState(false);
  const tone = trace.status === "success" ? "good" : trace.status === "warning" ? "warn" : "danger";
  return (
    <div className="relative mb-4 last:mb-0">
      <span className={`absolute -left-[18px] flex h-7 w-7 items-center justify-center rounded-full border bg-white shadow-sm ${toneStyle(tone)}`}>
        <Icon.Activity />
      </span>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full rounded-xl border p-3 text-left transition-all ${toneStyle(tone)} ${open ? "shadow-md" : ""}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold">{trace.agent_name}</p>
            {trace.agent_name === "ReAct Care Planner" && (
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[9px] font-semibold text-emerald-700">LLM + tools</span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-[10px] font-medium opacity-70">{formatTimestamp(trace.created_at)}</span>
            {trace.evidence.length > 0 && (
              <span className={`transition-transform ${open ? "rotate-180" : ""}`}>
                <Icon.ChevronDown />
              </span>
            )}
          </div>
        </div>
        <p className="mt-0.5 text-xs opacity-80">{trace.output_summary}</p>
        {open && trace.evidence.length > 0 && (
          <div className="mt-2.5 border-t border-current/15 pt-2.5">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] opacity-60">Evidence sources</p>
            <div className="grid gap-1.5">
              {trace.evidence.map((ev, i) => (
                <div key={i} className="rounded-lg border border-current/10 bg-white/50 px-2.5 py-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] opacity-60">{ev.type}</p>
                  <p className="text-xs font-medium opacity-90">{ev.source}</p>
                  {ev.supports && <p className="mt-0.5 text-[10px] opacity-70">{ev.supports}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </button>
    </div>
  );
}

const urgencyStyles: Record<string, string> = {
  high: "border-red-200 bg-red-50 text-red-700",
  medium: "border-amber-200 bg-amber-50 text-amber-700",
  low: "border-slate-200 bg-slate-50 text-slate-600",
};

const alertTypeLabel: Record<string, string> = {
  overdue_watering: "Overdue watering",
  consecutive_skips: "Repeated skips",
  heat_stress: "Heat stress",
  frost_risk: "Frost risk",
  disease_follow_up: "Disease follow-up",
  heavy_rain_outdoor: "Heavy rain",
};

function AlertsPanel({ alerts }: { alerts: PlantAlert[] }) {
  const visible = alerts.filter((a) => a.urgency === "high" || a.urgency === "medium");
  if (visible.length === 0) return null;

  return (
    <div className="mb-4 grid gap-2">
      {visible.map((alert) => (
        <div
          key={alert.id}
          className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${urgencyStyles[alert.urgency] ?? urgencyStyles.low}`}
        >
          <span className="mt-0.5 shrink-0">
            <Icon.AlertTriangle />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold">
              {alert.plantName} &middot; {alertTypeLabel[alert.alertType] ?? alert.alertType}
            </p>
            <p className="mt-0.5 text-xs leading-5 opacity-80">{alert.message}</p>
          </div>
          <span className="ml-auto shrink-0 text-[10px] font-semibold uppercase tracking-wide opacity-60">
            {alert.urgency}
          </span>
        </div>
      ))}
    </div>
  );
}

function FreshnessBanner({
  generatedAt,
  onRefresh,
  refreshing,
}: {
  generatedAt: string;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const ageHours = (Date.now() - new Date(generatedAt).getTime()) / 3600000;
  if (ageHours < 6) return null;

  const label =
    ageHours >= 48
      ? `Plan is ${Math.round(ageHours / 24)} days old`
      : ageHours >= 24
        ? "Plan is 1 day old"
        : `Plan is ${Math.round(ageHours)} hours old`;

  const isStale = ageHours >= 24;

  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-2.5 text-sm ${
        isStale
          ? "border-amber-200 bg-amber-50 text-amber-800"
          : "border-slate-200 bg-slate-50 text-slate-600"
      }`}
    >
      <span className="flex items-center gap-2">
        <Icon.RefreshCw />
        {label} — conditions may have changed.
      </span>
      <button
        type="button"
        onClick={onRefresh}
        disabled={refreshing}
        className={`shrink-0 rounded-lg px-3 py-1 text-xs font-semibold transition ${
          isStale
            ? "bg-amber-600 text-white hover:bg-amber-700"
            : "bg-slate-200 text-slate-700 hover:bg-slate-300"
        } disabled:opacity-60`}
      >
        {refreshing ? "Refreshing…" : "Refresh now"}
      </button>
    </div>
  );
}

function OverviewTab({ context, carePlan }: { context: ContextJson; carePlan: CarePlanOutput }) {
  const activeRisks = getActiveRisks(carePlan);
  const nextAction = carePlan.today_actions[0] ?? carePlan.upcoming_tasks[0] ?? null;

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
      <Panel className="p-5">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <Eyebrow>Action queue · {formatLongDate(carePlan.today_actions[0]?.due_date ?? carePlan.generated_at.slice(0, 10))}</Eyebrow>
            <h2 className="mt-1 text-lg font-semibold text-[var(--color-ink)]">Today&apos;s care tasks</h2>
          </div>
          <span className="rounded-full border border-[var(--color-line)] bg-[var(--color-canvas)] px-3 py-1 text-xs font-semibold text-[var(--color-muted)]">
            {carePlan.today_actions.length} tasks
          </span>
        </div>
        <div className="grid gap-2">
          {carePlan.today_actions.length > 0 ? (
            carePlan.today_actions.map((action) => <ActionRow key={action.id} action={action} />)
          ) : (
            <p className="rounded-xl border border-[var(--color-line)] bg-[var(--color-canvas-soft)] px-4 py-5 text-sm text-[var(--color-muted)]">
              No care actions are due today.
            </p>
          )}
        </div>
      </Panel>

      <div className="grid content-start gap-4">
        <SetupMismatchPanel carePlan={carePlan} />
        <Panel className="p-5">
          <Eyebrow>Garden health score</Eyebrow>
          <div className="mt-3 flex items-center gap-4">
            <div className="relative shrink-0">
              <Ring value={carePlan.summary.health_score} size={80} />
              <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-[var(--color-ink)]">
                {carePlan.summary.health_score}
              </span>
            </div>
            <div>
              <p className="text-xl font-bold text-[var(--color-ink)]">{toTitle(carePlan.summary.health_band)}</p>
              <p className="mt-0.5 text-xs text-[var(--color-muted)]">
                {carePlan.summary.total_plants} plants · {carePlan.summary.identified_plants} identified
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                {activeRisks.length > 0 ? activeRisks.map((risk) => (
                  <Badge key={risk} tone="warn">{risk}</Badge>
                )) : <Badge tone="good">No active risks</Badge>}
              </div>
            </div>
          </div>
        </Panel>

        <Panel className="p-5">
          <Eyebrow>Next best action</Eyebrow>
          {nextAction ? (
            <div className="mt-2">
              <p className="font-semibold text-[var(--color-ink)]">{nextAction.title}</p>
              <p className="mt-0.5 text-xs text-[var(--color-muted)]">{nextAction.plant_name || "Garden"}</p>
              <p className="mt-2 text-xs leading-5 text-[var(--color-muted)]">{nextAction.reason}</p>
              <div className="mt-3">
                <Badge tone={priorityTone(nextAction.priority)}>{toTitle(nextAction.priority)} priority</Badge>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-sm text-[var(--color-muted)]">No next action is currently required.</p>
          )}
        </Panel>

        <Panel className="p-4">
          <Eyebrow>Local weather</Eyebrow>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {[
              { label: "Temp", value: formatMetric(context.environment.temperature_c, "C"), icon: <Icon.Thermometer /> },
              { label: "Humidity", value: formatMetric(context.environment.humidity_percent, "%"), icon: <Icon.Droplet /> },
              { label: "UV", value: context.environment.uv_index ?? "No data", icon: <Icon.Sun /> },
              { label: "Wind", value: formatMetric(context.environment.wind_speed_kph, "kph"), icon: <Icon.Wind /> },
              { label: "Rain", value: formatMetric(context.environment.rainfall_mm, "mm"), icon: <Icon.Droplet /> },
              { label: "ET0", value: formatMetric(context.environment.evapotranspiration_mm, "mm"), icon: <Icon.TrendingUp /> },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-[var(--color-line)] bg-[var(--color-canvas-soft)] px-2.5 py-2.5">
                <span className="text-[var(--color-canopy)]">{item.icon}</span>
                <p className="mt-1 text-sm font-bold text-[var(--color-ink)]">{item.value}</p>
                <p className="text-[9px] uppercase tracking-wide text-[var(--color-muted)]">{item.label}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function SetupMismatchPanel({ carePlan }: { carePlan: CarePlanOutput }) {
  const mismatches = carePlan.setup_mismatches ?? [];
  if (mismatches.length === 0) return null;

  const mismatchTypeIcon: Record<string, string> = {
    soil: "🪨",
    sunlight: "☀️",
    placement: "📍",
    identity: "🔬",
  };

  return (
    <Panel className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <Eyebrow>Setup issues</Eyebrow>
          <h2 className="mt-1 text-base font-semibold text-[var(--color-ink)]">{mismatches.length} plant setup {mismatches.length === 1 ? "mismatch" : "mismatches"}</h2>
        </div>
        <Badge tone="warn">{mismatches.filter((m) => m.severity === "high").length} high</Badge>
      </div>
      <div className="grid gap-2">
        {mismatches.map((m) => (
          <div key={`${m.plant_id}-${m.type}`} className={`rounded-xl border px-4 py-3 ${toneStyle(priorityTone(m.severity))}`}>
            <div className="flex items-start gap-2">
              <span className="mt-0.5 shrink-0 text-base">{mismatchTypeIcon[m.type] ?? "⚠️"}</span>
              <div className="min-w-0">
                <p className="text-xs font-semibold">{m.plant_name} · {toTitle(m.type)} mismatch</p>
                <p className="mt-0.5 text-[10px] opacity-80">Current: {m.current}</p>
                <p className="text-[10px] opacity-80">Expected: {m.expected}</p>
                <p className="mt-1 text-[10px] leading-4 opacity-90">{m.recommendation}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

type DiagnosisSummary = {
  id: string;
  issue: string;
  category: string;
  severity: string;
  confidence: number;
  summary: string;
  createdAt: string;
  photoUrl: string;
};

const severityStyle: Record<string, string> = {
  high: "border-red-200 bg-red-50 text-red-700",
  medium: "border-amber-200 bg-amber-50 text-amber-700",
  low: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

function DiagnosisGallery({ plantId }: { plantId: string }) {
  const [diagnoses, setDiagnoses] = useState<DiagnosisSummary[] | null>(null);

  useEffect(() => {
    setDiagnoses(null);
    fetch(`/api/diagnosis/by-plant?plantId=${encodeURIComponent(plantId)}`)
      .then((r) => r.json())
      .then((data: { diagnoses: DiagnosisSummary[] }) => setDiagnoses(data.diagnoses ?? []))
      .catch(() => setDiagnoses([]));
  }, [plantId]);

  if (diagnoses === null) return <p className="mt-1 text-xs text-[var(--color-muted)]">Loading…</p>;
  if (diagnoses.length === 0) return <p className="mt-1 text-xs text-[var(--color-muted)]">No diagnoses yet. Run one from the diagnosis page.</p>;

  return (
    <div className="mt-1 grid gap-2">
      {diagnoses.map((d) => (
        <div key={d.id} className={`flex gap-3 rounded-xl border p-2 ${severityStyle[d.severity] ?? severityStyle.low}`}>
          <img
            src={d.photoUrl}
            alt={d.issue}
            className="h-14 w-14 shrink-0 rounded-lg object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-semibold truncate">{d.issue}</p>
              <span className="shrink-0 text-[9px] font-bold uppercase">{d.severity}</span>
            </div>
            <p className="mt-0.5 text-[10px] opacity-80 line-clamp-2">{d.summary}</p>
            <p className="mt-1 text-[9px] opacity-60">
              {new Date(d.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · {d.confidence}% confidence
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

const CARE_ACTIONS = [
  { type: "watered",   label: "Watered",    emoji: "💧" },
  { type: "fertilized", label: "Fertilized", emoji: "🌱" },
  { type: "inspected", label: "Inspected",  emoji: "🔍" },
] as const;

function ManualCareLog({ plantId, plantName }: { plantId: string; plantName: string }) {
  const [logging, setLogging] = useState<string | null>(null);
  const [logged, setLogged] = useState<string | null>(null);

  async function logCare(eventType: string) {
    if (logging) return;
    setLogging(eventType);
    try {
      await fetch("/api/plants/log-care", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plantId, plantName, eventType }),
      });
      setLogged(eventType);
      setTimeout(() => setLogged(null), 2000);
    } finally {
      setLogging(null);
    }
  }

  return (
    <div className="mt-1">
      <div className="flex flex-wrap gap-1.5">
        {CARE_ACTIONS.map((action) => (
          <button
            key={action.type}
            type="button"
            onClick={() => logCare(action.type)}
            disabled={!!logging}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition disabled:opacity-60 ${
              logged === action.type
                ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                : "border-[var(--color-line)] bg-white text-[var(--color-muted)] hover:border-[var(--color-canopy)]/20 hover:bg-[var(--color-canvas-soft)] hover:text-[var(--color-ink)]"
            }`}
          >
            {logging === action.type ? "…" : action.emoji} {logged === action.type ? "Logged!" : action.label}
          </button>
        ))}
      </div>
      <p className="mt-1.5 text-[9px] text-[var(--color-muted)]">Logs to health history and updates the care timeline.</p>
    </div>
  );
}

const eventTypeLabel: Record<string, { label: string; color: string }> = {
  watered:        { label: "Watered",      color: "bg-blue-100 text-blue-700" },
  water_skipped:  { label: "Skipped",      color: "bg-amber-100 text-amber-700" },
  inspected:      { label: "Inspected",    color: "bg-emerald-100 text-emerald-700" },
  fertilized:     { label: "Fertilized",   color: "bg-purple-100 text-purple-700" },
  diagnosed:      { label: "Diagnosed",    color: "bg-red-100 text-red-700" },
  weather_alert:  { label: "Weather",      color: "bg-orange-100 text-orange-700" },
  care_note:      { label: "Note",         color: "bg-slate-100 text-slate-600" },
};

type TrendPoint = { date: string; score: number };

function HealthTrendSparkline({ plantId }: { plantId: string }) {
  const [trend, setTrend] = useState<TrendPoint[] | null>(null);

  useEffect(() => {
    setTrend(null);
    fetch(`/api/plants/trend?plantId=${encodeURIComponent(plantId)}`)
      .then((r) => r.json())
      .then((data: { trend: TrendPoint[] }) => setTrend(data.trend ?? []))
      .catch(() => setTrend([]));
  }, [plantId]);

  if (trend === null) {
    return <p className="mt-1 text-xs text-[var(--color-muted)]">Loading trend…</p>;
  }

  if (trend.length === 0) {
    return <p className="mt-1 text-xs text-[var(--color-muted)]">No trend data yet.</p>;
  }

  const W = 240;
  const H = 48;
  const pad = 4;
  const points = trend.map((p, i) => {
    const x = pad + (i / (trend.length - 1)) * (W - pad * 2);
    const y = H - pad - ((p.score / 100) * (H - pad * 2));
    return `${x},${y}`;
  });
  const polyline = points.join(" ");
  const lastScore = trend[trend.length - 1].score;
  const color = lastScore >= 75 ? "#10b981" : lastScore >= 50 ? "#f59e0b" : "#ef4444";

  return (
    <div className="mt-1">
      <div className="flex items-center justify-between text-[10px] text-[var(--color-muted)]">
        <span>14-day health trend</span>
        <span className="font-semibold" style={{ color }}>{lastScore}/100</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-1 w-full" style={{ height: H }}>
        <defs>
          <linearGradient id={`grad-${plantId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.2" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon
          points={`${pad},${H} ${polyline} ${W - pad},${H}`}
          fill={`url(#grad-${plantId})`}
        />
        <polyline points={polyline} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
        <circle
          cx={points[points.length - 1].split(",")[0]}
          cy={points[points.length - 1].split(",")[1]}
          r="3"
          fill={color}
        />
      </svg>
    </div>
  );
}

type PlantNote = { id: string; body: string; createdAt: string };

function PlantNotes({ plantId, plantName }: { plantId: string; plantName: string }) {
  const [notes, setNotes] = useState<PlantNote[] | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setNotes(null);
    fetch(`/api/plants/notes?plantId=${encodeURIComponent(plantId)}`)
      .then((r) => r.json())
      .then((d: { notes: PlantNote[] }) => setNotes(d.notes ?? []))
      .catch(() => setNotes([]));
  }, [plantId]);

  async function submit() {
    if (!draft.trim() || saving) return;
    setSaving(true);
    const res = await fetch("/api/plants/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plantId, plantName, body: draft }),
    }).catch(() => null);
    setSaving(false);
    if (res?.ok) {
      const data = (await res.json()) as { note: PlantNote };
      setNotes((prev) => [data.note, ...(prev ?? [])]);
      setDraft("");
    }
  }

  async function remove(noteId: string) {
    await fetch(`/api/plants/notes?noteId=${encodeURIComponent(noteId)}`, { method: "DELETE" }).catch(() => null);
    setNotes((prev) => prev?.filter((n) => n.id !== noteId) ?? []);
  }

  return (
    <div className="mt-1 grid gap-2">
      <div className="flex gap-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void submit(); } }}
          placeholder="Add a note… (Enter to save)"
          rows={2}
          className="flex-1 resize-none rounded-lg border border-[var(--color-line)] bg-white px-3 py-2 text-xs text-[var(--color-ink)] placeholder:text-[var(--color-muted)] focus:border-[var(--color-canopy)]/40 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => void submit()}
          disabled={!draft.trim() || saving}
          className="self-end rounded-lg bg-[var(--color-canopy)] px-3 py-2 text-[10px] font-semibold text-white disabled:opacity-40"
        >
          Save
        </button>
      </div>
      {notes === null ? (
        <p className="text-[10px] text-[var(--color-muted)]">Loading…</p>
      ) : notes.length === 0 ? (
        <p className="text-[10px] text-[var(--color-muted)]">No notes yet.</p>
      ) : (
        notes.map((note) => (
          <div key={note.id} className="group relative rounded-lg border border-[var(--color-line)] bg-white px-3 py-2">
            <p className="text-xs leading-5 text-[var(--color-ink)]">{note.body}</p>
            <div className="mt-1 flex items-center justify-between">
              <p className="text-[9px] text-[var(--color-muted)]">
                {new Date(note.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </p>
              <button
                type="button"
                onClick={() => void remove(note.id)}
                className="text-[9px] text-[var(--color-muted)] opacity-0 transition group-hover:opacity-100 hover:text-red-500"
              >
                Delete
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

const GROWTH_STAGES = ["seedling", "sprout", "growing", "mature", "flowering", "dormant"] as const;
type GrowthStage = (typeof GROWTH_STAGES)[number];
const STAGE_EMOJI: Record<GrowthStage, string> = {
  seedling: "🌱", sprout: "🌿", growing: "🌳", mature: "🌲", flowering: "🌸", dormant: "💤",
};

type Milestone = { id: string; plant_id: string; plant_name: string; stage: string; note: string | null; recorded_at: string };

function GrowthMilestones({ plantId, plantName }: { plantId: string; plantName: string }) {
  const [milestones, setMilestones] = useState<Milestone[] | null>(null);
  const [selectedStage, setSelectedStage] = useState<GrowthStage>("growing");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setMilestones(null);
    fetch(`/api/plants/milestones?plantId=${encodeURIComponent(plantId)}`)
      .then((r) => r.json())
      .then((d: { milestones: Milestone[] }) => setMilestones(d.milestones ?? []))
      .catch(() => setMilestones([]));
  }, [plantId]);

  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/plants/milestones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plantId, plantName, stage: selectedStage, note: note.trim() || undefined }),
      });
      const d = await res.json() as { milestone: Milestone };
      setMilestones((prev) => [d.milestone, ...(prev ?? [])]);
      setNote("");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    await fetch(`/api/plants/milestones?milestoneId=${id}`, { method: "DELETE" });
    setMilestones((prev) => (prev ?? []).filter((m) => m.id !== id));
  }

  return (
    <div className="mt-2 grid gap-2">
      <div className="flex flex-wrap gap-1.5">
        {GROWTH_STAGES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSelectedStage(s)}
            className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition ${
              selectedStage === s
                ? "border-[var(--color-canopy)]/30 bg-[var(--color-canopy)] text-white"
                : "border-[var(--color-line)] bg-white text-[var(--color-muted)] hover:bg-[var(--color-canvas-soft)]"
            }`}
          >
            {STAGE_EMOJI[s]} {s}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional note…"
          className="flex-1 rounded-xl border border-[var(--color-line)] bg-white px-2.5 py-1.5 text-xs focus:outline-none focus:border-[var(--color-canopy)]/40"
        />
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-xl border border-[var(--color-canopy)]/30 bg-[var(--color-canopy)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          {saving ? "…" : "Log"}
        </button>
      </div>
      {milestones === null ? (
        <p className="text-xs text-[var(--color-muted)]">Loading…</p>
      ) : milestones.length === 0 ? (
        <p className="text-xs text-[var(--color-muted)]">No milestones yet.</p>
      ) : (
        <div className="grid gap-1.5 max-h-40 overflow-y-auto">
          {milestones.map((m) => (
            <div key={m.id} className="flex items-start justify-between gap-2 rounded-xl border border-[var(--color-line)] bg-white px-2.5 py-1.5">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[var(--color-ink)]">
                  {STAGE_EMOJI[m.stage as GrowthStage] ?? "🌿"} {m.stage}
                </p>
                {m.note && <p className="mt-0.5 text-[10px] text-[var(--color-muted)] truncate">{m.note}</p>}
                <p className="text-[10px] text-[var(--color-muted)]">{new Date(m.recorded_at).toLocaleDateString()}</p>
              </div>
              <button type="button" onClick={() => remove(m.id)} className="shrink-0 text-[var(--color-muted)] hover:text-red-500 text-xs">✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PlantHealthHistory({ plantId }: { plantId: string }) {
  const [events, setEvents] = useState<HealthEvent[] | null>(null);

  useEffect(() => {
    setEvents(null);
    fetch(`/api/plants/health?plantId=${encodeURIComponent(plantId)}`)
      .then((r) => r.json())
      .then((data: { history: HealthEvent[] }) => setEvents(data.history ?? []))
      .catch(() => setEvents([]));
  }, [plantId]);

  if (events === null) {
    return <p className="mt-1 text-xs text-[var(--color-muted)]">Loading history…</p>;
  }

  if (events.length === 0) {
    return <p className="mt-1 text-xs text-[var(--color-muted)]">No care events recorded yet. Complete a task to start tracking.</p>;
  }

  return (
    <div className="mt-1 grid gap-1.5">
      {events.slice(0, 8).map((event) => {
        const style = eventTypeLabel[event.eventType] ?? { label: event.eventType, color: "bg-slate-100 text-slate-600" };
        return (
          <div key={event.id} className="flex items-center gap-2.5">
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${style.color}`}>
              {style.label}
            </span>
            <span className="min-w-0 flex-1 truncate text-[10px] text-[var(--color-muted)]">{event.detail}</span>
            <span className="shrink-0 text-[9px] text-[var(--color-muted)]">
              {new Date(event.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function computeNextWater(lastWateredAt: string | null | undefined, intervalDays: number | null): { label: string; urgent: boolean } | null {
  if (!intervalDays || !lastWateredAt) return null;
  const last = new Date(lastWateredAt);
  const next = new Date(last);
  next.setDate(next.getDate() + intervalDays);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  next.setHours(0, 0, 0, 0);
  const diff = Math.round((next.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return { label: `${Math.abs(diff)}d overdue`, urgent: true };
  if (diff === 0) return { label: "Water today", urgent: true };
  if (diff === 1) return { label: "Water tomorrow", urgent: false };
  return { label: `Water in ${diff}d`, urgent: false };
}

function PlantsTab({ context, carePlan }: { context: ContextJson; carePlan: CarePlanOutput }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = carePlan.plant_plans.find((plant) => plant.plant_id === selectedId) ?? carePlan.plant_plans[0] ?? null;

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
      <Panel className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <Eyebrow>Collection</Eyebrow>
            <h2 className="mt-1 text-lg font-semibold text-[var(--color-ink)]">All plants</h2>
          </div>
          <span className="rounded-full border border-[var(--color-line)] bg-[var(--color-canvas)] px-3 py-1 text-xs font-semibold text-[var(--color-muted)]">
            {carePlan.plant_plans.length} total
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {carePlan.plant_plans.length > 0 ? carePlan.plant_plans.map((plant, index) => (
            <Card
              key={plant.plant_id}
              onClick={() => setSelectedId(plant.plant_id)}
              className={`p-4 transition-all hover:border-[var(--color-canopy)]/20 hover:shadow-md ${selected?.plant_id === plant.plant_id ? "border-[var(--color-canopy)]/30 ring-2 ring-[var(--color-canopy)]/20" : ""}`}
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base font-bold text-white shadow-sm" style={{ background: getPlantColor(index) }}>
                    {plant.plant_name.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--color-ink)]">{plant.plant_name}</p>
                    <p className="truncate text-[10px] italic text-[var(--color-muted)]">{plant.species ?? "Needs identification"}</p>
                  </div>
                </div>
                <StatusPill readiness={plant.readiness} />
              </div>
              <div className="mb-1.5 flex justify-between text-[10px] font-semibold">
                <span className="text-[var(--color-muted)]">Plan confidence</span>
                <span className={healthText(Math.round(plant.confidence * 100))}>{Math.round(plant.confidence * 100)}%</span>
              </div>
              <MiniBar value={Math.round(plant.confidence * 100)} grad={healthGrad(Math.round(plant.confidence * 100))} />
              {(() => {
                const forecast = carePlan.watering_forecast.find((f) => f.plant_id === plant.plant_id);
                const nextWaterDay = forecast?.days.find((d) => d.label === "water");
                if (!nextWaterDay) return (
                  <p className="mt-2 text-[10px] text-[var(--color-muted)]">Water: {plant.watering_interval_days ? `every ${plant.watering_interval_days}d` : "no data"}</p>
                );
                const today = new Date().toISOString().slice(0, 10);
                const diff = Math.round((new Date(nextWaterDay.date).getTime() - new Date(today).getTime()) / 86400000);
                const urgent = diff <= 0;
                return (
                  <div className="mt-2 flex items-center gap-1.5">
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${urgent ? "border-blue-300 bg-blue-50 text-blue-700" : "border-[var(--color-line)] bg-[var(--color-canvas)] text-[var(--color-muted)]"}`}>
                      💧 {diff <= 0 ? "Water today" : diff === 1 ? "Water tomorrow" : `Water in ${diff}d`}
                    </span>
                  </div>
                );
              })()}
            </Card>
          )) : (
            <p className="rounded-xl border border-[var(--color-line)] bg-[var(--color-canvas-soft)] px-4 py-5 text-sm text-[var(--color-muted)]">
              No plants found. Add a plant to generate care plans.
            </p>
          )}
        </div>
      </Panel>

      <Panel className="p-5">
        {selected ? (
          <div className="animate-fade-rise">
            <div className="mb-5">
              <p className="text-base font-semibold text-[var(--color-ink)]">{selected.plant_name}</p>
              <p className="text-xs italic text-[var(--color-muted)]">{selected.species ?? "Needs identification"}</p>
            </div>
            <div className="grid gap-2">
              {[
                ["Status", toTitle(selected.readiness)],
                ["Watering", selected.watering_interval_days ? `Every ${selected.watering_interval_days} days` : "Needs care data"],
                ["Sunlight", selected.sunlight_requirement],
                ["Soil", selected.soil_drainage_advice],
                ["Placement", selected.placement_advice],
                ["Growth stage", toTitle(context.plants.find((plant) => plant.plant_id === selected.plant_id)?.growth_stage ?? "unknown")],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-[var(--color-canvas-soft)] px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">{label}</p>
                  <p className="mt-1 text-xs font-semibold leading-5 text-[var(--color-ink)]">{value}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-xl border border-[var(--color-line)] bg-[var(--color-canvas-soft)] p-3">
              <p className="text-xs font-semibold text-[var(--color-ink)]">Why</p>
              <p className="mt-1 text-xs leading-5 text-[var(--color-muted)]">{selected.watering_reason}</p>
            </div>
            <div className="mt-4 rounded-xl border border-[var(--color-line)] bg-[var(--color-canvas-soft)] p-3">
              <p className="text-xs font-semibold text-[var(--color-ink)]">Notes</p>
              <PlantNotes plantId={selected.plant_id} plantName={selected.plant_name} />
            </div>
            <div className="mt-4 rounded-xl border border-[var(--color-line)] bg-[var(--color-canvas-soft)] p-3">
              <p className="text-xs font-semibold text-[var(--color-ink)]">Log care</p>
              <ManualCareLog plantId={selected.plant_id} plantName={selected.plant_name} />
            </div>
            <div className="mt-4 rounded-xl border border-[var(--color-line)] bg-[var(--color-canvas-soft)] p-3">
              <p className="text-xs font-semibold text-[var(--color-ink)]">Health trend</p>
              <HealthTrendSparkline plantId={selected.plant_id} />
            </div>
            <div className="mt-4 rounded-xl border border-[var(--color-line)] bg-[var(--color-canvas-soft)] p-3">
              <p className="text-xs font-semibold text-[var(--color-ink)]">Diagnosis history</p>
              <DiagnosisGallery plantId={selected.plant_id} />
            </div>
            <div className="mt-4 rounded-xl border border-[var(--color-line)] bg-[var(--color-canvas-soft)] p-3">
              <p className="text-xs font-semibold text-[var(--color-ink)]">Growth milestones</p>
              <GrowthMilestones plantId={selected.plant_id} plantName={selected.plant_name} />
            </div>
            <div className="mt-4 rounded-xl border border-[var(--color-line)] bg-[var(--color-canvas-soft)] p-3">
              <p className="text-xs font-semibold text-[var(--color-ink)]">Care history</p>
              <PlantHealthHistory plantId={selected.plant_id} />
            </div>
            <Link href="/diagnosis" className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--color-canopy)]/20 bg-[var(--color-canopy)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[var(--color-canopy)]/90">
              <Icon.Activity /> Run diagnosis
            </Link>
          </div>
        ) : (
          <div className="flex min-h-64 flex-col items-center justify-center gap-2 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--color-line)] bg-[var(--color-canvas-soft)] text-[var(--color-muted)]">
              <Icon.Leaf />
            </div>
            <p className="text-sm font-medium text-[var(--color-muted)]">No plant selected</p>
          </div>
        )}
      </Panel>
    </div>
  );
}

const ACTION_TYPE_CONFIG: Record<string, { emoji: string; color: string }> = {
  water:        { emoji: "💧", color: "bg-blue-500 text-white border-blue-600" },
  skip_water:   { emoji: "⏭", color: "bg-slate-200 text-slate-600 border-slate-300" },
  fertilize:    { emoji: "🌱", color: "bg-purple-500 text-white border-purple-600" },
  inspect:      { emoji: "🔍", color: "bg-amber-400 text-white border-amber-500" },
  disease_watch:{ emoji: "🦠", color: "bg-red-500 text-white border-red-600" },
  move:         { emoji: "📦", color: "bg-teal-500 text-white border-teal-600" },
  shade:        { emoji: "⛱", color: "bg-indigo-400 text-white border-indigo-500" },
  protect:      { emoji: "🛡", color: "bg-orange-500 text-white border-orange-600" },
  prune:        { emoji: "✂️", color: "bg-emerald-500 text-white border-emerald-600" },
  drainage:     { emoji: "🚿", color: "bg-cyan-500 text-white border-cyan-600" },
  identify:     { emoji: "🔬", color: "bg-pink-400 text-white border-pink-500" },
};

function buildCalendarDays(carePlan: CarePlanOutput): { date: string; label: string; actions: CarePlanAction[] }[] {
  const all = [...carePlan.today_actions, ...carePlan.upcoming_tasks];
  const byDate = new Map<string, CarePlanAction[]>();

  for (const action of all) {
    if (!byDate.has(action.due_date)) byDate.set(action.due_date, []);
    byDate.get(action.due_date)!.push(action);
  }

  const today = new Date();
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const date = d.toISOString().slice(0, 10);
    const dayName = i === 0 ? "Today" : i === 1 ? "Tomorrow" : d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    return { date, label: dayName, actions: byDate.get(date) ?? [] };
  });

  return days;
}

function ForecastTab({ carePlan }: { carePlan: CarePlanOutput }) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const calendarDays = buildCalendarDays(carePlan);
  const today = new Date().toISOString().slice(0, 10);

  const focusDayActions = selectedDate
    ? (calendarDays.find((d) => d.date === selectedDate)?.actions ?? [])
    : (calendarDays[0]?.actions ?? []);
  const focusLabel = selectedDate
    ? (calendarDays.find((d) => d.date === selectedDate)?.label ?? selectedDate)
    : "Today";

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
      {/* Calendar grid */}
      <Panel className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <Eyebrow>Care calendar</Eyebrow>
            <h2 className="mt-1 text-lg font-semibold text-[var(--color-ink)]">14-day schedule</h2>
          </div>
          <div className="flex flex-wrap gap-1">
            {Object.entries(ACTION_TYPE_CONFIG).slice(0, 4).map(([type, cfg]) => (
              <span key={type} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-semibold ${cfg.color}`}>
                {cfg.emoji} {toTitle(type)}
              </span>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {calendarDays.map((day) => {
            const isToday = day.date === today;
            const isSelected = day.date === (selectedDate ?? today);
            const hasActions = day.actions.length > 0;
            const hasHigh = day.actions.some((a) => a.priority === "high");

            return (
              <button
                key={day.date}
                type="button"
                onClick={() => setSelectedDate(day.date)}
                className={`relative flex min-h-[72px] flex-col rounded-xl border p-2 text-left transition-all hover:shadow-md ${
                  isSelected
                    ? "border-[var(--color-canopy)]/40 bg-[var(--color-canopy)]/5 shadow-sm"
                    : isToday
                      ? "border-[var(--color-canopy)]/20 bg-[var(--color-canvas-soft)]"
                      : "border-[var(--color-line)] bg-white"
                }`}
              >
                {isToday && (
                  <span className="absolute left-2 top-1.5 h-1 w-1 rounded-full bg-[var(--color-canopy)]" />
                )}
                <p className={`text-[9px] font-bold uppercase tracking-wide ${isToday ? "text-[var(--color-canopy)]" : "text-[var(--color-muted)]"}`}>
                  {new Date(day.date + "T00:00:00Z").toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" })}
                </p>
                <p className={`mt-0.5 text-sm font-bold ${isSelected ? "text-[var(--color-canopy)]" : "text-[var(--color-ink)]"}`}>
                  {new Date(day.date + "T00:00:00Z").getUTCDate()}
                </p>
                {hasActions ? (
                  <div className="mt-auto flex flex-wrap gap-0.5">
                    {day.actions.slice(0, 3).map((a) => {
                      const cfg = ACTION_TYPE_CONFIG[a.type] ?? ACTION_TYPE_CONFIG.inspect;
                      return (
                        <span key={a.id} className={`inline-flex h-4 w-4 items-center justify-center rounded border text-[9px] ${cfg.color}`}>
                          {cfg.emoji}
                        </span>
                      );
                    })}
                    {day.actions.length > 3 && (
                      <span className="inline-flex h-4 items-center rounded border border-[var(--color-line)] bg-[var(--color-canvas)] px-0.5 text-[8px] text-[var(--color-muted)]">
                        +{day.actions.length - 3}
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="mt-auto text-[8px] text-[var(--color-muted)]/50">Rest</p>
                )}
                {hasHigh && (
                  <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-red-500" />
                )}
              </button>
            );
          })}
        </div>

        {/* Watering table below calendar */}
        {carePlan.watering_forecast.length > 0 && (
          <div className="mt-5">
            <p className="mb-3 text-xs font-semibold text-[var(--color-muted)]">Watering schedule</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="pb-2 pr-3 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">Plant</th>
                    {carePlan.watering_forecast[0]?.days.map((day) => (
                      <th key={day.date} className="px-1 pb-2 text-center text-[10px] font-semibold text-[var(--color-muted)]">
                        {new Date(day.date + "T00:00:00Z").getUTCDate()}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-line)]">
                  {carePlan.watering_forecast.map((forecast, idx) => (
                    <tr key={forecast.plant_id}>
                      <td className="py-2 pr-3">
                        <div className="flex items-center gap-1.5">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[9px] font-bold text-white" style={{ background: getPlantColor(idx) }}>
                            {forecast.plant_name.charAt(0)}
                          </span>
                          <span className="truncate text-[10px] font-medium text-[var(--color-ink)]">{forecast.plant_name}</span>
                        </div>
                      </td>
                      {forecast.days.map((day) => (
                        <td key={`${forecast.plant_id}-${day.date}`} className="px-1 py-2 text-center">
                          <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full border text-[9px] font-bold ${
                            day.label === "water" ? "border-blue-300 bg-blue-500 text-white" :
                            day.label === "skip" ? "border-blue-100 bg-blue-50 text-blue-400" :
                            "border-transparent text-[var(--color-muted)]/30"
                          }`}>
                            {day.label === "water" ? "W" : day.label === "skip" ? "S" : "·"}
                          </span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Panel>

      {/* Day detail panel */}
      <div className="grid content-start gap-4">
        <Panel className="p-5">
          <Eyebrow>{focusLabel}</Eyebrow>
          <h2 className="mt-1 text-base font-semibold text-[var(--color-ink)]">
            {focusDayActions.length} {focusDayActions.length === 1 ? "task" : "tasks"}
          </h2>
          <div className="mt-3 grid gap-2">
            {focusDayActions.length > 0 ? focusDayActions.map((action) => {
              const cfg = ACTION_TYPE_CONFIG[action.type] ?? ACTION_TYPE_CONFIG.inspect;
              return (
                <div key={action.id} className="flex items-start gap-2.5 rounded-xl border border-[var(--color-line)] bg-[var(--color-canvas-soft)] px-3 py-2.5">
                  <span className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-sm ${cfg.color}`}>
                    {cfg.emoji}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[var(--color-ink)]">{action.title}</p>
                    <p className="mt-0.5 text-[10px] text-[var(--color-muted)]">{action.plant_name}</p>
                    <p className="mt-1 text-[10px] leading-4 text-[var(--color-muted)]">{action.reason}</p>
                  </div>
                </div>
              );
            }) : (
              <p className="rounded-xl border border-[var(--color-line)] bg-[var(--color-canvas-soft)] px-3 py-4 text-center text-xs text-[var(--color-muted)]">
                Rest day — no tasks scheduled.
              </p>
            )}
          </div>
        </Panel>

        {carePlan.weather_risk_forecast.length > 0 && (
          <Panel className="p-5">
            <Eyebrow>Weather risks</Eyebrow>
            <h2 className="mb-3 mt-1 text-base font-semibold text-[var(--color-ink)]">7-day view</h2>
            <div className="grid grid-cols-4 gap-1.5">
              {carePlan.weather_risk_forecast.slice(0, 7).map((day) => (
                <div key={day.date} className={`rounded-xl border p-2 text-center ${day.risk_count > 0 ? "border-amber-200 bg-amber-50 text-amber-700" : "border-emerald-100 bg-emerald-50 text-emerald-700"}`}>
                  <p className="text-[9px] font-bold">{formatDate(day.date)}</p>
                  <p className="mt-0.5 text-lg font-bold">{day.risk_count}</p>
                  <p className="text-[8px]">risks</p>
                </div>
              ))}
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}

function ActivityTab({ carePlan }: { carePlan: CarePlanOutput }) {
  const reactTrace = carePlan.agent_traces.find((t) => t.agent_name === "ReAct Care Planner");
  const toolCallMatch = reactTrace?.output_summary.match(/(\d+) tool calls/);
  const iterMatch = reactTrace?.output_summary.match(/(\d+) iterations/);

  return (
    <div className="grid gap-4">
      {reactTrace && (
        <Panel className="p-5">
          <Eyebrow>AI reasoning</Eyebrow>
          <h2 className="mb-3 mt-1 text-lg font-semibold text-[var(--color-ink)]">ReAct Care Planner</h2>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              { label: "Tool calls", value: toolCallMatch?.[1] ?? "—", icon: <Icon.Zap /> },
              { label: "Iterations", value: iterMatch?.[1] ?? "—", icon: <Icon.RefreshCw /> },
              { label: "Actions", value: String(carePlan.today_actions.length), icon: <Icon.CheckCircle /> },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-[var(--color-line)] bg-[var(--color-canvas-soft)] px-3 py-3">
                <span className="text-[var(--color-canopy)]">{item.icon}</span>
                <p className="mt-1 text-xl font-bold text-[var(--color-ink)]">{item.value}</p>
                <p className="text-[9px] uppercase tracking-wide text-[var(--color-muted)]">{item.label}</p>
              </div>
            ))}
          </div>
          <p className="text-xs leading-5 text-[var(--color-muted)]">{reactTrace.output_summary}</p>
          <div className="mt-3 grid gap-1.5">
            {reactTrace.evidence.map((e, i) => (
              <div key={i} className="rounded-lg bg-[var(--color-canvas-soft)] px-3 py-2 text-[10px] text-[var(--color-muted)]">
                <span className="font-semibold text-[var(--color-ink)]">{e.source}</span> &middot; {e.supports}
              </div>
            ))}
          </div>
        </Panel>
      )}

      <Panel className="p-5">
        <Eyebrow>Agent trace</Eyebrow>
        <h2 className="mb-5 mt-1 text-lg font-semibold text-[var(--color-ink)]">All agents</h2>
        <div className="relative pl-8">
          <div className="absolute bottom-0 left-3.5 top-0 w-px bg-[var(--color-line)]" />
          {carePlan.agent_traces.map((trace) => (
            <AgentTraceRow key={trace.id} trace={trace} />
          ))}
        </div>
      </Panel>
    </div>
  );
}

function AnalyticsTab({ carePlan }: { carePlan: CarePlanOutput }) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Panel className="p-5">
        <Eyebrow>Water balance</Eyebrow>
        <h2 className="mb-4 mt-1 text-lg font-semibold text-[var(--color-ink)]">ET0, rain, soil moisture</h2>
        <div className="grid gap-2">
          {carePlan.water_balance.map((item) => (
            <div key={item.plant_id} className="rounded-xl border border-[var(--color-line)] bg-[var(--color-canvas-soft)] px-3 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-[var(--color-ink)]">{item.plant_name}</p>
                <Badge tone={item.status === "high_need" ? "danger" : item.status === "moderate_need" ? "warn" : "good"}>
                  {toTitle(item.status)}
                </Badge>
              </div>
              <p className="mt-1 text-[10px] text-[var(--color-muted)]">
                ET0 {formatMetric(item.et0_mm, "mm")} · Rain {formatMetric(item.rain_mm, "mm")} · Soil {item.soil_moisture_ratio ?? "No data"}
              </p>
            </div>
          ))}
        </div>
      </Panel>

      <Panel className="p-5">
        <Eyebrow>Care adherence</Eyebrow>
        <h2 className="mb-4 mt-1 text-lg font-semibold text-[var(--color-ink)]">Weekly completion</h2>
        <div className="mb-4 flex items-end gap-3">
          <p className="text-5xl font-bold text-[var(--color-ink)]">{carePlan.care_adherence.weekly_completion_rate}%</p>
          <p className="mb-1 text-xs text-[var(--color-muted)]">
            {carePlan.care_adherence.weekly_completed} of {carePlan.care_adherence.weekly_due} tasks
          </p>
        </div>
        <MiniBar value={carePlan.care_adherence.weekly_completion_rate} grad="from-[var(--color-canopy)] to-[var(--color-emerald)]" />
        <div className="mt-4 grid gap-1.5">
          {carePlan.care_adherence.by_plant.map((plant) => (
            <div key={plant.plant_id} className="flex items-center justify-between rounded-xl bg-[var(--color-canvas-soft)] px-3 py-2 text-xs">
              <span className="font-medium text-[var(--color-ink)]">{plant.plant_name}</span>
              <span className="text-[var(--color-muted)]">{plant.completed}/{plant.due} ({plant.completion_rate}%)</span>
            </div>
          ))}
        </div>
      </Panel>

      <Panel className="p-5">
        <Eyebrow>Diagnosis outcomes</Eyebrow>
        <h2 className="mb-4 mt-1 text-lg font-semibold text-[var(--color-ink)]">Health tracking</h2>
        <div className="grid grid-cols-3 gap-3">
          {[
            ["Diagnosed", carePlan.outcome_tracking.total_diagnoses],
            ["Recurrence", `${carePlan.outcome_tracking.symptom_recurrence_rate}%`],
            ["Effectiveness", `${carePlan.outcome_tracking.before_after_effectiveness}%`],
          ].map(([label, value]) => (
            <Card key={label} className="p-4 text-center">
              <p className="text-2xl font-bold text-[var(--color-ink)]">{value}</p>
              <p className="mt-0.5 text-[10px] text-[var(--color-muted)]">{label}</p>
            </Card>
          ))}
        </div>
      </Panel>

      <Panel className="p-5">
        <Eyebrow>Evidence</Eyebrow>
        <h2 className="mb-4 mt-1 text-lg font-semibold text-[var(--color-ink)]">Sources used</h2>
        <div className="grid gap-2">
          {carePlan.evidence_sources.slice(0, 6).map((source) => (
            <div key={`${source.type}-${source.source}`} className="rounded-xl border border-[var(--color-line)] bg-[var(--color-canvas-soft)] px-3 py-2">
              <p className="text-xs font-semibold text-[var(--color-ink)]">{formatSourceName(source.source)}</p>
              <p className="mt-1 text-[10px] leading-4 text-[var(--color-muted)]">{source.supports}</p>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

export function CareDashboardView({
  context,
  carePlan,
  alerts,
}: {
  context: ContextJson;
  carePlan: CarePlanOutput;
  alerts: PlantAlert[];
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const [refreshing, setRefreshing] = useState(false);
  const activeRisks = getActiveRisks(carePlan);
  const identifiedPercent =
    carePlan.summary.total_plants > 0
      ? Math.round((carePlan.summary.identified_plants / carePlan.summary.total_plants) * 100)
      : 0;
  const highPriorityCount = carePlan.today_actions.filter((action) => action.priority === "high").length;

  async function refreshPlan() {
    setRefreshing(true);
    try {
      await fetch("/api/care-plan/generate", { method: "POST" });
      window.location.reload();
    } finally {
      setRefreshing(false);
    }
  }

  const hasPlants = context.plants.length > 0;

  return (
    <div className="grid gap-5 animate-fade-rise">
      {!hasPlants && (
        <section className="surface-panel px-5 py-6 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-[var(--color-ink)]">Welcome to BloomPilot</h2>
              <p className="mt-1 text-sm text-[var(--color-muted)]">Add your first plant to unlock personalized care plans, reminders, and health tracking.</p>
            </div>
            <a
              href="/garden"
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-[var(--color-canopy)] px-5 text-sm font-semibold text-white shadow-sm hover:bg-[var(--color-moss)] transition-colors"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
                <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z" />
                <path d="M12 22V12" />
              </svg>
              Add your first plant
            </a>
          </div>
        </section>
      )}
      <section
        className="relative overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.08)] shadow-[0_14px_36px_rgba(20,52,39,0.2)]"
        style={{ background: "linear-gradient(135deg,#0c2518 0%,#143427 40%,#1a5238 70%,#2d7a52 100%)" }}
      >
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full border border-white/5" />
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full border border-white/5" />
        <div className="relative px-5 py-4 lg:px-6 lg:py-5">
          <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-white/85 backdrop-blur">
                  <span className={`h-1.5 w-1.5 rounded-full ${carePlan.status === "ready" ? "bg-emerald-400" : "bg-amber-300"}`} />
                  {carePlan.status === "ready" ? "Care plan ready" : "Care plan partial"}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/8 px-3 py-1 text-xs font-medium text-white/70">
                  <Icon.Zap /> {carePlan.agent_traces.filter((trace) => trace.status === "success").length}/{carePlan.agent_traces.length} agents complete
                </span>
              </div>
              <h1 className="text-xl font-bold tracking-tight text-white lg:text-[1.7rem]">
                {context.user.name ? `${context.user.name}'s garden dashboard` : "Garden dashboard"}
              </h1>
            </div>

            <div className="flex min-w-[180px] flex-col gap-2">
              <button
                type="button"
                onClick={refreshPlan}
                disabled={refreshing}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white px-4 text-sm font-semibold text-[var(--color-ink)] shadow-[0_8px_20px_rgba(0,0,0,0.18)] transition hover:bg-slate-50 disabled:opacity-70"
              >
                <span className={refreshing ? "animate-spin" : ""}><Icon.RefreshCw /></span>
                {refreshing ? "Refreshing..." : "Refresh plan"}
              </button>
              <Link
                href="/garden"
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-white/22 bg-white/12 px-4 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
              >
                <Icon.Leaf /> Manage plants
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Due today" value={carePlan.today_actions.length} detail={`${highPriorityCount} high priority`} icon={<Icon.Calendar />} accentClass="from-red-400 to-red-500" />
        <StatCard label="Garden health" value={`${carePlan.summary.health_score}/100`} detail={toTitle(carePlan.summary.health_band)} icon={<Icon.Leaf />} accentClass="from-emerald-400 to-emerald-500" />
        <StatCard label="Plant data" value={`${identifiedPercent}%`} detail={`${carePlan.summary.identified_plants} of ${carePlan.summary.total_plants} species identified`} icon={<Icon.TrendingUp />} accentClass="from-blue-400 to-blue-500" />
        <StatCard label="Weather risks" value={carePlan.summary.active_risks} detail={activeRisks.length > 0 ? activeRisks.join(", ") : "No active risks"} icon={<Icon.Sun />} accentClass="from-amber-400 to-amber-500" />
      </section>

      <FreshnessBanner generatedAt={carePlan.generated_at} onRefresh={refreshPlan} refreshing={refreshing} />

      <AlertsPanel alerts={alerts} />

      <nav className="sticky top-[88px] z-20 flex gap-1 rounded-2xl border border-[var(--color-line)] bg-[rgba(247,246,241,0.92)] p-1 shadow-[0_8px_28px_rgba(20,52,39,0.08)] backdrop-blur">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-all ${
              tab === item.id
                ? "bg-[var(--color-canopy)] text-white shadow-[0_2px_8px_rgba(20,52,39,0.25)]"
                : "text-[var(--color-muted)] hover:bg-white hover:text-[var(--color-ink)]"
            }`}
          >
            <span className="h-4 w-4">{item.icon}</span>
            <span className="hidden sm:inline">{item.label}</span>
          </button>
        ))}
      </nav>

      <div key={tab} className="animate-fade-rise">
        {tab === "overview" && <OverviewTab context={context} carePlan={carePlan} />}
        {tab === "plants" && <PlantsTab context={context} carePlan={carePlan} />}
        {tab === "forecast" && <ForecastTab carePlan={carePlan} />}
        {tab === "activity" && <ActivityTab carePlan={carePlan} />}
        {tab === "analytics" && <AnalyticsTab carePlan={carePlan} />}
      </div>
    </div>
  );
}
