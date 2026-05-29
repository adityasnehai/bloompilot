import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { readWorkspaceIdentityByEmail } from "@/lib/workspace-store";
import { getGardenStats, type PlantHealthRow, type DiagnosisTrendPoint, type TaskCompletionByKind } from "@/lib/garden-stats";
import { SeasonalCard } from "@/components/stats/seasonal-card";

export const metadata = { title: "Garden Stats · BloomPilot" };

function StatCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent: string }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border p-5 ${accent}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-70">{label}</p>
      <p className="mt-2 text-4xl font-bold leading-none">{value}</p>
      {sub && <p className="mt-1.5 text-xs opacity-70">{sub}</p>}
    </div>
  );
}

function DiagnosisTrendBar({ points }: { points: DiagnosisTrendPoint[] }) {
  if (points.length === 0) return <p className="text-xs text-[var(--color-muted)]">No diagnoses in the last 6 months.</p>;
  const max = Math.max(...points.map((p) => p.count), 1);
  return (
    <div className="flex items-end gap-2 h-20">
      {points.map((p) => (
        <div key={p.month} className="flex flex-1 flex-col items-center gap-1">
          <div
            className="w-full rounded-t bg-purple-400 opacity-80 transition-all"
            style={{ height: `${Math.round((p.count / max) * 64)}px`, minHeight: 4 }}
            title={`${p.month}: ${p.count} diagnoses`}
          />
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
      <tbody className="divide-y divide-[rgba(16,52,39,0.06)]">
        {rows.map((r) => (
          <tr key={r.kind}>
            <td className="py-2 capitalize text-[var(--color-ink)]">{r.kind}</td>
            <td className="py-2 text-right text-[var(--color-ink)]">{r.done}</td>
            <td className="py-2 text-right text-[var(--color-muted)]">{r.total}</td>
            <td className="py-2 text-right">
              <span className={`font-medium ${r.rate >= 70 ? "text-emerald-600" : r.rate >= 40 ? "text-amber-600" : "text-red-500"}`}>{r.rate}%</span>
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
            <th className="pb-2 font-medium text-right"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[rgba(16,52,39,0.06)]">
          {rows.map((r) => {
            const skipRatio = r.waterCount + r.skipCount > 0 ? r.skipCount / (r.waterCount + r.skipCount) : 0;
            const health = skipRatio < 0.2 ? "good" : skipRatio < 0.5 ? "fair" : "poor";
            return (
              <tr key={r.plantId}>
                <td className="py-2">
                  <p className="font-medium text-[var(--color-ink)]">{r.plantName}</p>
                  {r.species && <p className="text-[10px] text-[var(--color-muted)]">{r.species}</p>}
                </td>
                <td className="py-2 text-right text-[var(--color-ink)]">{r.waterCount}</td>
                <td className="py-2 text-right text-[var(--color-muted)]">{r.skipCount}</td>
                <td className="py-2 text-right text-[var(--color-muted)]">{r.diagnosisCount}</td>
                <td className="py-2 pl-3 text-right">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    health === "good" ? "bg-emerald-50 text-emerald-700" :
                    health === "fair" ? "bg-amber-50 text-amber-700" :
                    "bg-red-50 text-red-700"
                  }`}>{health}</span>
                  <Link href={`/garden/${r.plantId}`} className="ml-2 text-[10px] text-[var(--color-moss)] underline underline-offset-2">view</Link>
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
    <div className="flex items-end gap-1 h-16">
      {days.map((d) => (
        <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
          <div
            className="w-full rounded-t bg-[var(--color-canopy)] opacity-80 transition-all"
            style={{ height: `${Math.round((d.count / max) * 56)}px`, minHeight: 4 }}
            title={`${d.date}: ${d.count} events`}
          />
          <p className="text-[8px] text-[var(--color-muted)] rotate-45 origin-left whitespace-nowrap hidden sm:block">
            {new Date(d.date + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}
          </p>
        </div>
      ))}
    </div>
  );
}

function GreenThumbRing({ score }: { score: number }) {
  const size = 120;
  const radius = 50;
  const circ = 2 * Math.PI * radius;
  const dash = (score / 100) * circ;
  const color = score >= 70 ? "#10b981" : score >= 40 ? "#f59e0b" : "#ef4444";
  const label = score >= 70 ? "Expert" : score >= 40 ? "Growing" : "Beginner";

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(20,52,39,0.08)" strokeWidth={12} />
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={12}
            strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-[var(--color-ink)]">{score}</span>
          <span className="text-[10px] text-[var(--color-muted)]">/100</span>
        </div>
      </div>
      <p className="text-sm font-semibold" style={{ color }}>{label} Gardener</p>
    </div>
  );
}

export default async function StatsPage() {
  const session = await requireSession();
  if (!session.onboarded) redirect("/onboarding");

  const identity = readWorkspaceIdentityByEmail(session.email);
  if (!identity) redirect("/onboarding");

  const stats = getGardenStats(identity.id);

  return (
    <div className="grid gap-6">
      {/* Header */}
      <section
        className="relative overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.08)] px-5 py-5 shadow-[0_14px_36px_rgba(20,52,39,0.2)]"
        style={{ background: "linear-gradient(135deg,#0c2518 0%,#143427 40%,#1a5238 70%,#2d7a52 100%)" }}
      >
        <h1 className="text-xl font-bold text-white">Garden stats</h1>
        <p className="mt-1 text-sm text-white/60">
          {stats.joinedDaysAgo > 0 ? `${stats.joinedDaysAgo} days of gardening with BloomPilot` : "Welcome! Your stats will appear here."}
        </p>
      </section>

      {/* Green thumb score */}
      <div className="rounded-2xl border border-[var(--color-line)] bg-white p-6 shadow-[0_2px_8px_rgba(20,52,39,0.06)]">
        <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-muted)]">Green thumb score</p>
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-8">
          <GreenThumbRing score={stats.greenThumbScore} />
          <div className="grid gap-2 text-sm text-[var(--color-muted)] flex-1">
            <p>Scored from task completion ({stats.taskCompletionRate}%), care streak ({stats.careStreak} days), waterings, and diagnoses.</p>
            {stats.mostCaredPlant && (
              <p>Most cared plant: <span className="font-semibold text-[var(--color-ink)]">{stats.mostCaredPlant.name}</span> ({stats.mostCaredPlant.count} events)</p>
            )}
          </div>
        </div>
      </div>

      {/* Stat grid */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Plants" value={stats.totalPlants} sub="in your garden" accent="border-emerald-200 bg-emerald-50 text-emerald-800" />
        <StatCard label="Waterings" value={stats.totalWaterings} sub="all-time" accent="border-blue-200 bg-blue-50 text-blue-800" />
        <StatCard label="Diagnoses" value={stats.totalDiagnoses} sub="health checks run" accent="border-purple-200 bg-purple-50 text-purple-800" />
        <StatCard label="Care streak" value={`${stats.careStreak}d`} sub="consecutive active days" accent="border-amber-200 bg-amber-50 text-amber-800" />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Task completion" value={`${stats.taskCompletionRate}%`} sub="last 30 days" accent="border-teal-200 bg-teal-50 text-teal-800" />
        <StatCard label="Skipped waterings" value={stats.totalSkips} sub="all-time skips" accent="border-orange-200 bg-orange-50 text-orange-800" />
        <StatCard label="Days active" value={stats.joinedDaysAgo} sub="since joining" accent="border-slate-200 bg-slate-50 text-slate-700" />
      </div>

      {/* Seasonal recommendations */}
      <SeasonalCard />

      {/* Per-plant health breakdown */}
      <div className="rounded-2xl border border-[var(--color-line)] bg-white p-5 shadow-[0_2px_8px_rgba(20,52,39,0.06)]">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-muted)]">Per-plant</p>
        <p className="mb-4 text-base font-semibold text-[var(--color-ink)]">Health breakdown</p>
        <PerPlantTable rows={stats.perPlantHealth} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Task completion by kind */}
        <div className="rounded-2xl border border-[var(--color-line)] bg-white p-5 shadow-[0_2px_8px_rgba(20,52,39,0.06)]">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-muted)]">Tasks</p>
          <p className="mb-4 text-base font-semibold text-[var(--color-ink)]">Completion by type · last 30d</p>
          <TaskCompletionTable rows={stats.taskCompletionByKind} />
        </div>

        {/* Diagnosis trend */}
        <div className="rounded-2xl border border-[var(--color-line)] bg-white p-5 shadow-[0_2px_8px_rgba(20,52,39,0.06)]">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-muted)]">Diagnosis</p>
          <p className="mb-4 text-base font-semibold text-[var(--color-ink)]">Trend · last 6 months</p>
          <DiagnosisTrendBar points={stats.diagnosisTrend} />
        </div>
      </div>

      {/* Activity chart */}
      <div className="rounded-2xl border border-[var(--color-line)] bg-white p-5 shadow-[0_2px_8px_rgba(20,52,39,0.06)]">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-muted)]">Activity</p>
        <p className="mb-4 text-base font-semibold text-[var(--color-ink)]">Last 14 days</p>
        <ActivityBar days={stats.recentActivityDays} />
      </div>
    </div>
  );
}
