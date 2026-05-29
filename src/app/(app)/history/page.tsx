"use client";

import { useEffect, useState } from "react";

type PlanSummary = {
  id: string;
  generatedAt: string;
  healthScore: number;
  totalPlants: number;
  activeRisks: number;
  todayActionsCount: number;
  upcomingTasksCount: number;
};

type CarePlanAction = {
  plant_name?: string;
  action_type?: string;
  title?: string;
  description?: string;
  due_date?: string;
  priority?: string;
};

type PlantCarePlan = {
  plant_name?: string;
  health_score?: number;
  health_band?: string;
  today_actions?: CarePlanAction[];
};

type FullPlan = {
  id: string;
  generatedAt: string;
  plan: {
    summary?: { health_score?: number; total_plants?: number; active_risks?: number; health_band?: string };
    today_actions?: CarePlanAction[];
    upcoming_tasks?: CarePlanAction[];
    plant_plans?: PlantCarePlan[];
  };
};

function scoreColor(score: number) {
  if (score >= 70) return "text-emerald-700 bg-emerald-50 border-emerald-200";
  if (score >= 40) return "text-amber-700 bg-amber-50 border-amber-200";
  return "text-red-700 bg-red-50 border-red-200";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const KIND_EMOJI: Record<string, string> = {
  water: "💧",
  feed: "🌱",
  inspect: "🔍",
  fertilize: "🌿",
  disease_watch: "🔬",
  drainage: "🪣",
};

function ActionRow({ action }: { action: CarePlanAction }) {
  const emoji = KIND_EMOJI[action.action_type ?? ""] ?? "📋";
  return (
    <div className="flex gap-3 rounded-xl border border-[var(--color-line)] bg-white px-3 py-2.5">
      <span className="mt-0.5 shrink-0 text-base">{emoji}</span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-[var(--color-ink)] leading-snug">{action.title ?? action.action_type}</p>
        {action.plant_name && (
          <p className="text-xs text-[var(--color-muted)] mt-0.5">{action.plant_name}</p>
        )}
        {action.description && (
          <p className="text-xs text-[var(--color-muted)] mt-0.5 leading-relaxed">{action.description}</p>
        )}
        {action.due_date && (
          <p className="text-[10px] text-[var(--color-muted)] mt-1">Due {action.due_date}</p>
        )}
      </div>
      {action.priority && (
        <span className={`ml-auto shrink-0 self-start rounded-full px-2 py-0.5 text-[10px] font-semibold border ${
          action.priority === "high" ? "bg-red-50 text-red-700 border-red-200" :
          action.priority === "medium" ? "bg-amber-50 text-amber-700 border-amber-200" :
          "bg-slate-50 text-slate-600 border-slate-200"
        }`}>
          {action.priority}
        </span>
      )}
    </div>
  );
}

function DetailPanel({ planId, onClose }: { planId: string; onClose: () => void }) {
  const [data, setData] = useState<FullPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    fetch(`/api/care-plan/history/${planId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setData(d as FullPlan))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [planId]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end" onClick={onClose}>
      <div
        className="relative h-full w-full max-w-lg overflow-y-auto bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[var(--color-line)] px-5 py-4"
          style={{ background: "linear-gradient(135deg,#143427,#2d7a52)" }}
        >
          <div>
            <p className="text-xs text-white/60">Care plan detail</p>
            {data && <p className="text-sm font-semibold text-white">{formatDate(data.generatedAt)}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/20 bg-white/10 p-1.5 text-white hover:bg-white/20"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className="p-5 grid gap-5">
          {loading && <p className="text-sm text-[var(--color-muted)]">Loading…</p>}
          {error && <p className="text-sm text-red-600">Failed to load plan.</p>}

          {data && (
            <>
              {/* Summary */}
              <div className="flex flex-wrap gap-2">
                <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${scoreColor(data.plan.summary?.health_score ?? 0)}`}>
                  Health {data.plan.summary?.health_score ?? 0}/100
                </span>
                {data.plan.summary?.health_band && (
                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                    {data.plan.summary.health_band}
                  </span>
                )}
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                  {data.plan.summary?.total_plants ?? 0} plants
                </span>
                {(data.plan.summary?.active_risks ?? 0) > 0 && (
                  <span className="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-2.5 py-0.5 text-xs font-semibold text-orange-700">
                    {data.plan.summary?.active_risks} risks
                  </span>
                )}
              </div>

              {/* Today actions */}
              {(data.plan.today_actions?.length ?? 0) > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-muted)] mb-2">
                    Today's actions ({data.plan.today_actions!.length})
                  </p>
                  <div className="grid gap-2">
                    {data.plan.today_actions!.map((action, i) => (
                      <ActionRow key={i} action={action} />
                    ))}
                  </div>
                </div>
              )}

              {/* Per-plant breakdown */}
              {(data.plan.plant_plans?.length ?? 0) > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-muted)] mb-2">
                    Plant breakdown
                  </p>
                  <div className="grid gap-3">
                    {data.plan.plant_plans!.map((pp, i) => (
                      <div key={i} className="rounded-xl border border-[var(--color-line)] bg-[var(--color-canvas-soft)] p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-[var(--color-ink)]">{pp.plant_name}</p>
                          {pp.health_score !== undefined && (
                            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${scoreColor(pp.health_score)}`}>
                              {pp.health_score}/100
                            </span>
                          )}
                        </div>
                        {pp.health_band && (
                          <p className="text-xs text-[var(--color-muted)] mt-0.5">{pp.health_band}</p>
                        )}
                        {(pp.today_actions?.length ?? 0) > 0 && (
                          <div className="mt-2 grid gap-1.5">
                            {pp.today_actions!.map((a, j) => (
                              <p key={j} className="text-xs text-[var(--color-ink)]">
                                {KIND_EMOJI[a.action_type ?? ""] ?? "📋"} {a.title ?? a.action_type}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Upcoming */}
              {(data.plan.upcoming_tasks?.length ?? 0) > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-muted)] mb-2">
                    Upcoming ({data.plan.upcoming_tasks!.length})
                  </p>
                  <div className="grid gap-2">
                    {data.plan.upcoming_tasks!.slice(0, 8).map((action, i) => (
                      <ActionRow key={i} action={action} />
                    ))}
                    {data.plan.upcoming_tasks!.length > 8 && (
                      <p className="text-xs text-[var(--color-muted)] text-center">
                        +{data.plan.upcoming_tasks!.length - 8} more
                      </p>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function HistoryPage() {
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/care-plan/history")
      .then((r) => r.json())
      .then((d) => setPlans((d as { plans: PlanSummary[] }).plans ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="grid gap-6">
      <section
        className="relative overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.08)] px-5 py-5 shadow-[0_14px_36px_rgba(20,52,39,0.2)]"
        style={{ background: "linear-gradient(135deg,#0c2518 0%,#143427 40%,#1a5238 70%,#2d7a52 100%)" }}
      >
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-white">Care plan history</h1>
            <p className="mt-1 text-sm text-white/60">Click any plan to see the full breakdown.</p>
          </div>
          <div className="flex gap-2">
            <a
              href="/api/care-plan/export?format=csv"
              download
              className="rounded-xl border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20 transition"
            >
              Export CSV
            </a>
            <a
              href="/api/care-plan/export?format=json"
              download
              className="rounded-xl border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20 transition"
            >
              Export JSON
            </a>
          </div>
        </div>
      </section>

      {loading && (
        <div className="rounded-2xl border border-[var(--color-line)] bg-white p-8 text-center text-sm text-[var(--color-muted)]">
          Loading history…
        </div>
      )}

      {!loading && plans.length === 0 && (
        <div className="rounded-2xl border border-[var(--color-line)] bg-white p-8 text-center text-sm text-[var(--color-muted)]">
          No care plans generated yet. Run a diagnosis or care plan from the dashboard.
        </div>
      )}

      {plans.map((plan, idx) => (
        <button
          key={plan.id}
          type="button"
          onClick={() => setSelectedId(plan.id)}
          className="w-full text-left rounded-2xl border border-[var(--color-line)] bg-white p-5 shadow-[0_2px_8px_rgba(20,52,39,0.06)] hover:border-[var(--color-canopy)]/30 hover:shadow-[0_4px_16px_rgba(20,52,39,0.1)] transition"
        >
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <p className="text-xs text-[var(--color-muted)] mb-0.5">
                {idx === 0 ? "Latest · " : ""}{formatDate(plan.generatedAt)}
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${scoreColor(plan.healthScore)}`}>
                  Health {plan.healthScore}/100
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                  {plan.totalPlants} plant{plan.totalPlants !== 1 ? "s" : ""}
                </span>
                {plan.activeRisks > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-orange-200 bg-orange-50 px-2.5 py-0.5 text-xs font-semibold text-orange-700">
                    {plan.activeRisks} risk{plan.activeRisks !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-semibold text-[var(--color-ink)]">{plan.todayActionsCount} actions</p>
              <p className="text-xs text-[var(--color-muted)]">{plan.upcomingTasksCount} upcoming</p>
              <p className="text-xs text-[var(--color-canopy)] mt-1">View details →</p>
            </div>
          </div>
        </button>
      ))}

      {selectedId && (
        <DetailPanel planId={selectedId} onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
}
