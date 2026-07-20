import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { readWorkspaceIdentityByEmail } from "@/lib/workspace-store";
import { getGardenStats, type PlantHealthRow, type DiagnosisTrendPoint, type TaskCompletionByKind } from "@/lib/garden-stats";
import { SeasonalCard } from "@/components/stats/seasonal-card";

export const metadata = { title: "Garden Stats · BloomPilot" };

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="relative min-w-0 overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4 shadow-[0_6px_20px_rgba(24,36,27,0.04)]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-muted)]">{label}</p>
      <p className="mt-2 text-[1.75rem] font-semibold leading-none tracking-[-0.04em] text-[var(--color-ink)]">{value}</p>
      {sub && <p className="mt-1 text-[11px] text-[var(--color-muted)]">{sub}</p>}
    </div>
  );
}

function DiagnosisTrendBar({ points }: { points: DiagnosisTrendPoint[] }) {
  if (points.length === 0) return <p className="text-xs text-[var(--color-muted)]">No diagnoses in the last 6 months.</p>;
  const max = Math.max(...points.map((p) => p.count), 1);
  return (
    <div className="grid h-28 grid-cols-6 items-end gap-2" aria-label="Diagnosis checks over the last six months">
      {points.map((p) => (
        <div key={p.month} className="flex h-full min-w-0 flex-col items-center justify-end gap-1.5">
          <span className="text-[10px] font-medium text-[var(--color-ink)]">{p.count}</span>
          <div className="flex h-16 w-full items-end rounded-md bg-[var(--color-canvas-soft)] px-1">
            <div
              className="w-full rounded-sm bg-[var(--color-canopy)] transition-all"
              style={{ height: `${Math.max(Math.round((p.count / max) * 56), p.count > 0 ? 6 : 2)}px` }}
              title={`${p.month}: ${p.count} diagnoses`}
            />
          </div>
          <p className="text-[9px] text-[var(--color-muted)]">{p.month.slice(5)}</p>
        </div>
      ))}
    </div>
  );
}

function TaskCompletionTable({ rows }: { rows: TaskCompletionByKind[] }) {
  if (rows.length === 0) return <p className="text-xs text-[var(--color-muted)]">No tasks in the last 30 days.</p>;
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-[10px] uppercase tracking-[0.12em] text-[var(--color-muted)]">
          <th className="pb-2 font-medium">Task type</th>
          <th className="pb-2 font-medium text-right">Done</th>
          <th className="pb-2 font-medium text-right">Total</th>
          <th className="pb-2 font-medium text-right">Rate</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-[var(--color-line)]">
        {rows.map((r) => (
          <tr key={r.kind}>
            <td className="py-3 capitalize text-[var(--color-ink)]">{r.kind}</td>
            <td className="py-2 text-right text-[var(--color-ink)]">{r.done}</td>
            <td className="py-2 text-right text-[var(--color-muted)]">{r.total}</td>
            <td className="py-2 pl-3 text-right">
              <div className="flex items-center justify-end gap-2">
                <span className="hidden h-1.5 w-14 overflow-hidden rounded-full bg-[var(--color-canvas-soft)] sm:block">
                  <span className="block h-full rounded-full bg-[var(--color-canopy)]" style={{ width: `${r.rate}%` }} />
                </span>
                <span className="font-medium text-[var(--color-ink)]">{r.rate}%</span>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PerPlantTable({ rows }: { rows: PlantHealthRow[] }) {
  if (rows.length === 0) return <p className="text-xs text-[var(--color-muted)]">No plants tracked yet.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] text-sm">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-[0.12em] text-[var(--color-muted)]">
            <th className="pb-2 font-medium">Plant</th>
            <th className="pb-2 font-medium text-right">Waterings</th>
            <th className="pb-2 font-medium text-right">Skips</th>
            <th className="pb-2 font-medium text-right">Diagnoses</th>
            <th className="pb-2 font-medium text-right">Consistency</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-line)]">
          {rows.map((r) => {
            const skipRatio = r.waterCount + r.skipCount > 0 ? r.skipCount / (r.waterCount + r.skipCount) : 0;
            const consistency = skipRatio < 0.2 ? "steady" : skipRatio < 0.5 ? "mixed" : "needs focus";
            return (
              <tr key={r.plantId}>
                <td className="py-3">
                  <p className="font-medium text-[var(--color-ink)]">{r.plantName}</p>
                  {r.species && <p className="text-[10px] text-[var(--color-muted)]">{r.species}</p>}
                </td>
                <td className="py-3 text-right text-[var(--color-ink)]">{r.waterCount}</td>
                <td className="py-3 text-right text-[var(--color-muted)]">{r.skipCount}</td>
                <td className="py-3 text-right text-[var(--color-muted)]">{r.diagnosisCount}</td>
                <td className="py-3 pl-3 text-right">
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                    consistency === "steady"
                      ? "border-white/10 bg-white/5 text-[var(--color-muted)]"
                      : consistency === "mixed"
                        ? "border-white/12 bg-white/8 text-[var(--color-ink)]"
                        : "border-white/14 bg-white/10 text-[var(--color-ink)]"
                  }`}>{consistency}</span>
                  <Link href={`/garden/${r.plantId}`} className="ml-2 text-[10px] text-[var(--color-muted)] underline underline-offset-2 hover:text-[var(--color-ink)]">view</Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ActivityBar({ days }: { days: { date: string; count: number }[] }) {
  if (days.length === 0) return <p className="text-xs text-[var(--color-muted)]">No activity in the last 14 days.</p>;
  const max = Math.max(...days.map((d) => d.count), 1);
  return (
    <div className="grid h-28 grid-cols-[repeat(14,minmax(0,1fr))] items-end gap-1" aria-label="Care activity over the last fourteen days">
      {days.map((d) => (
        <div key={d.date} className="flex h-full min-w-0 flex-col items-center justify-end gap-1">
          <span className="text-[9px] font-medium text-[var(--color-ink)]">{d.count || ""}</span>
          <div
            className="w-full rounded-t bg-[var(--color-canopy)] transition-all"
            style={{ height: `${Math.max(Math.round((d.count / max) * 56), d.count > 0 ? 6 : 2)}px`, opacity: d.count > 0 ? 0.85 : 0.2 }}
            title={`${d.date}: ${d.count} events`}
          />
          <p className="truncate text-[8px] text-[var(--color-muted)]">
            {new Date(d.date + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}
          </p>
        </div>
      ))}
    </div>
  );
}

export default async function StatsPage() {
  const session = await requireSession();
  if (!session.onboarded) redirect("/onboarding");

  const identity = await readWorkspaceIdentityByEmail(session.email);
  if (!identity) redirect("/onboarding");

  const stats = await getGardenStats(identity.id);

  const focusPlants = stats.perPlantHealth.filter((plant) => plant.skipCount > 0).slice(0, 3);

  return (
    <div className="mx-auto grid w-full max-w-[1400px] gap-5">
      <header className="border-b border-[var(--color-line)] pb-4">
        <p className="eyebrow">Your garden</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-[-0.02em] text-[var(--color-ink)]">Garden stats</h1>
        <p className="mt-1 max-w-xl text-sm leading-6 text-[var(--color-muted)]">Care patterns, follow-through, and plant activity in one view.</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Plants" value={stats.totalPlants} sub="tracked" />
        <StatCard label="Task completion" value={`${stats.taskCompletionRate}%`} sub="last 30 days" />
        <StatCard label="Care streak" value={`${stats.careStreak}d`} sub="active days" />
        <StatCard label="Health checks" value={stats.totalDiagnoses} sub="all time" />
      </div>

      <section className="surface-panel p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="eyebrow">Focus</p>
            <h2 className="mt-1 text-lg font-semibold tracking-[-0.02em] text-[var(--color-ink)]">Watering follow-through</h2>
          </div>
          <Link href="/tasks" className="text-xs font-medium text-[var(--color-muted)] underline underline-offset-2 hover:text-[var(--color-ink)]">View tasks</Link>
        </div>
        {focusPlants.length > 0 ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {focusPlants.map((plant) => (
              <Link key={plant.plantId} href={`/garden/${plant.plantId}`} className="surface-card px-3 py-2 transition hover:bg-white/8">
                <p className="truncate text-sm font-medium text-[var(--color-ink)]">{plant.plantName}</p>
                <p className="mt-0.5 text-xs text-[var(--color-muted)]">{plant.skipCount} skipped watering{plant.skipCount === 1 ? "" : "s"}</p>
              </Link>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-[var(--color-muted)]">No skipped waterings recorded.</p>
        )}
      </section>

      <SeasonalCard />

      <section className="surface-panel p-5">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="eyebrow">Plants</p>
            <h2 className="mt-1 text-lg font-semibold tracking-[-0.02em] text-[var(--color-ink)]">Care patterns</h2>
          </div>
          <span className="text-xs text-[var(--color-muted)]">waterings and checks</span>
        </div>
        <PerPlantTable rows={stats.perPlantHealth} />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="surface-panel p-5">
          <p className="eyebrow">Tasks</p>
          <h2 className="mt-1 mb-4 text-lg font-semibold tracking-[-0.02em] text-[var(--color-ink)]">Completion by type</h2>
          <TaskCompletionTable rows={stats.taskCompletionByKind} />
        </section>
        <section className="surface-panel p-5">
          <p className="eyebrow">Checks</p>
          <h2 className="mt-1 mb-4 text-lg font-semibold tracking-[-0.02em] text-[var(--color-ink)]">Diagnosis trend</h2>
          <DiagnosisTrendBar points={stats.diagnosisTrend} />
        </section>
      </div>

      <section className="surface-panel p-5">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="eyebrow">Activity</p>
            <h2 className="mt-1 text-lg font-semibold tracking-[-0.02em] text-[var(--color-ink)]">Last 14 days</h2>
          </div>
          {stats.mostCaredPlant ? <p className="text-xs text-[var(--color-muted)]">Most logged: {stats.mostCaredPlant.name}</p> : null}
        </div>
        <ActivityBar days={stats.recentActivityDays} />
      </section>
    </div>
  );
}
