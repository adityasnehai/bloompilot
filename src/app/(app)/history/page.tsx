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
  if (score >= 70) return "text-[var(--color-ink)] bg-[var(--color-canvas-mint)] border-[var(--color-line)]";
  if (score >= 40) return "text-[var(--color-ink)] bg-[var(--color-canvas-soft)] border-[var(--color-line)]";
  return "text-[var(--color-ink)] bg-[var(--color-surface)] border-[var(--color-line-strong)]";
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

function ActionRow({ action }: { action: CarePlanAction }) {
  return (
    <div className="flex min-w-0 items-start gap-3 rounded-xl border border-[var(--color-line)] bg-[var(--color-canvas-sage)] px-3 py-3">
      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-canopy)]" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-snug text-[var(--color-ink)]">{action.title ?? action.action_type}</p>
        {action.plant_name && (
          <p className="mt-0.5 text-xs text-[var(--color-muted)]">{action.plant_name}</p>
        )}
        {action.description && (
          <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-[var(--color-muted)]">{action.description}</p>
        )}
        {action.due_date && (
          <p className="mt-1 text-[10px] text-[var(--color-muted)]">Due {action.due_date}</p>
        )}
      </div>
      {action.priority && (
        <span className={`ml-auto shrink-0 self-start rounded-full px-2 py-0.5 text-[10px] font-semibold border ${
          action.priority === "high" ? "bg-[var(--color-canvas-mint)] text-[var(--color-ink)] border-[var(--color-line)]" :
          action.priority === "medium" ? "bg-[var(--color-canvas-soft)] text-[var(--color-ink)] border-[var(--color-line)]" :
          "bg-[var(--color-surface)] text-[var(--color-muted)] border-[var(--color-line)]"
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
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    fetch(`/api/care-plan/history/${planId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setData(d as FullPlan))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [planId]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/20 p-0 sm:p-4" role="dialog" aria-modal="true" aria-label="Care plan details" onClick={onClose}>
      <div
        className="relative h-full w-full max-w-lg overflow-y-auto rounded-none border border-[var(--color-line)] bg-[var(--color-surface)] shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[var(--color-line)] bg-[var(--color-surface)] px-5 py-4">
          <div>
            <p className="eyebrow">Saved plan</p>
            {data && <p className="text-sm font-semibold text-[var(--color-ink)]">{formatDate(data.generatedAt)}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close care plan details"
            className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] p-1.5 text-[var(--color-ink)] hover:bg-[var(--color-canvas-soft)]"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className="grid gap-4 p-4 sm:p-5">
          {loading && <p className="text-sm text-[var(--color-muted)]">Loading plan…</p>}
          {error && <p role="alert" className="rounded-lg border border-[var(--color-line)] bg-[var(--color-canvas-soft)] px-3 py-2 text-sm text-[var(--color-muted)]">Could not load this plan.</p>}

          {data && (
            <>
              {/* Summary */}
              <div className="flex flex-wrap gap-2">
                <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${scoreColor(data.plan.summary?.health_score ?? 0)}`}>
                  Plan score {data.plan.summary?.health_score ?? 0}/100
                </span>
                {data.plan.summary?.health_band && (
                    <span className="inline-flex items-center rounded-full border border-[var(--color-line)] bg-[var(--color-canvas-soft)] px-2.5 py-0.5 text-xs font-semibold text-[var(--color-muted)]">
                    {data.plan.summary.health_band}
                  </span>
                )}
                <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs font-semibold text-[var(--color-muted)]">
                  {data.plan.summary?.total_plants ?? 0} plants
                </span>
                {(data.plan.summary?.active_risks ?? 0) > 0 && (
                    <span className="inline-flex items-center rounded-full border border-[var(--color-line)] bg-[var(--color-canvas-mint)] px-2.5 py-0.5 text-xs font-semibold text-[var(--color-ink)]">
                    {data.plan.summary?.active_risks} risks
                  </span>
                )}
              </div>

              {/* Today actions */}
              {(data.plan.today_actions?.length ?? 0) > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-muted)] mb-2">
                    Today&apos;s care ({data.plan.today_actions!.length})
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
                    By plant
                  </p>
                  <div className="grid gap-3">
                    {data.plan.plant_plans!.map((pp, i) => (
                      <div key={i} className="rounded-xl border border-[var(--color-line)] bg-[var(--color-canvas-sage)] p-3">
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
                                {a.title ?? a.action_type}
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
                    Coming up ({data.plan.upcoming_tasks!.length})
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
  const [error, setError] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/care-plan/history")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("history_failed"))))
      .then((d) => setPlans((d as { plans: PlanSummary[] }).plans ?? []))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="grid gap-4">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--color-line)] pb-4">
        <div>
          <p className="eyebrow">Archive</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-[-0.02em] text-[var(--color-ink)]">Care history</h1>
          <p className="mt-1 text-sm leading-6 text-[var(--color-muted)]">Review saved plans and the actions they created.</p>
        </div>
        <div className="flex flex-wrap gap-2">
            <a
              href="/api/care-plan/export?format=csv"
              download
              className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-ink)] transition hover:bg-[var(--color-canvas-soft)]"
            >
              Export CSV
            </a>
            <a
              href="/api/care-plan/export?format=json"
              download
              className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-ink)] transition hover:bg-[var(--color-canvas-soft)]"
            >
              Export JSON
            </a>
        </div>
      </header>

      {loading && (
        <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5 text-sm text-[var(--color-muted)]">
          Loading plans…
        </div>
      )}

      {!loading && error && (
        <div role="alert" className="rounded-xl border border-[var(--color-line)] bg-[var(--color-canvas-soft)] p-4 text-sm text-[var(--color-muted)]">
          Could not load care plan history. Refresh the page and try again.
        </div>
      )}

      {!loading && !error && plans.length === 0 && (
        <div className="rounded-xl border border-dashed border-[var(--color-line)] bg-[var(--color-surface)] p-5 text-sm text-[var(--color-muted)]">
          No saved care plans yet. Generate a plan from the dashboard to start your archive.
        </div>
      )}

      {plans.map((plan, idx) => (
        <button
          key={plan.id}
          type="button"
          onClick={() => setSelectedId(plan.id)}
          className="w-full rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4 text-left shadow-[0_6px_20px_rgba(24,36,27,0.04)] transition hover:border-[var(--color-line-strong)] hover:shadow-[0_10px_26px_rgba(24,36,27,0.08)]"
        >
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <p className="text-xs text-[var(--color-muted)]">
                {idx === 0 ? "Latest · " : ""}{formatDate(plan.generatedAt)}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${scoreColor(plan.healthScore)}`}>
                  Plan score {plan.healthScore}/100
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-line)] bg-[var(--color-canvas-soft)] px-2.5 py-0.5 text-xs font-semibold text-[var(--color-muted)]">
                  {plan.totalPlants} plant{plan.totalPlants !== 1 ? "s" : ""}
                </span>
                {plan.activeRisks > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-line)] bg-[var(--color-canvas-mint)] px-2.5 py-0.5 text-xs font-semibold text-[var(--color-ink)]">
                    {plan.activeRisks} risk{plan.activeRisks !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-semibold text-[var(--color-ink)]">{plan.todayActionsCount} today</p>
              <p className="text-xs text-[var(--color-muted)]">{plan.upcomingTasksCount} upcoming</p>
              <p className="mt-2 text-xs font-medium text-[var(--color-canopy)]">Open plan →</p>
            </div>
          </div>
        </button>
      ))}

      {selectedId && (
        <DetailPanel key={selectedId} planId={selectedId} onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
}
