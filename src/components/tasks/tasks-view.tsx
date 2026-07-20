"use client";

import Link from "next/link";
import { AlertTriangle, CalendarDays, CheckCircle2, ListChecks } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { TaskCard, type CareTask } from "@/components/garden/task-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type Plant = { id: string; nickname: string };

type TasksViewProps = {
  overdueTasks: CareTask[];
  dueTodayTasks: CareTask[];
  upcomingTasks: CareTask[];
  completedTasks: CareTask[];
  plantMap: [string, Plant][];
};

export function TasksView({ overdueTasks, dueTodayTasks, upcomingTasks, completedTasks, plantMap: plantMapEntries }: TasksViewProps) {
  const router = useRouter();
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [localDone, setLocalDone] = useState<Set<string>>(new Set());
  const plantMap = new Map(plantMapEntries);

  const batchAction = useCallback(async (taskIds: string[]) => {
    if (taskIds.length === 0) return;
    setBatchLoading(true);
    setBatchError(null);
    try {
      const response = await fetch("/api/tasks/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskIds, action: "done" }),
      });
      if (!response.ok) throw new Error("Unable to update tasks");
      setLocalDone((prev) => new Set([...prev, ...taskIds]));
      router.refresh();
    } catch {
      setBatchError("Could not update the selected tasks. Try again.");
      setLocalDone((prev) => {
        const next = new Set(prev);
        taskIds.forEach((id) => next.delete(id));
        return next;
      });
    } finally {
      setBatchLoading(false);
    }
  }, [router]);

  const allActiveTasks = useMemo(
    () => [...overdueTasks, ...dueTodayTasks, ...upcomingTasks],
    [overdueTasks, dueTodayTasks, upcomingTasks],
  );

  const overdueVisible = overdueTasks.filter((task) => !localDone.has(task.id));
  const todayVisible = dueTodayTasks.filter((task) => !localDone.has(task.id));
  const upcomingVisible = upcomingTasks.filter((task) => !localDone.has(task.id));
  const activeCount = allActiveTasks.filter((task) => !localDone.has(task.id)).length;
  const completedVisible = completedTasks.slice(0, 5);

  return (
    <div className="grid gap-6">
      <section className="border-b border-[var(--color-line)] pb-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="eyebrow">Tasks</p>
            <h1 className="mt-2 text-2xl font-bold tracking-[-0.04em] text-[var(--color-ink)] lg:text-3xl">Care queue</h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--color-muted)]">Do what is due now, then follow the next care items in order.</p>
          </div>
          <Button asChild variant="outline" size="sm" className="w-fit rounded-lg">
            <Link href="/garden">Manage plants</Link>
          </Button>
        </div>
        <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-canvas-soft)] px-3 py-3">
            <div className="flex items-center gap-2 text-[var(--color-muted)]">
              <ListChecks className="h-4 w-4 text-[var(--color-canopy)]" />
              <span className="text-[11px] uppercase tracking-[0.14em]">Open</span>
            </div>
            <p className="mt-2 text-2xl font-bold text-[var(--color-ink)]">{activeCount}</p>
          </div>
          <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-canvas-soft)] px-3 py-3">
            <div className="flex items-center gap-2 text-[var(--color-muted)]">
              <CalendarDays className="h-4 w-4 text-[var(--color-canopy)]" />
              <span className="text-[11px] uppercase tracking-[0.14em]">Due today</span>
            </div>
            <p className="mt-2 text-2xl font-bold text-[var(--color-ink)]">{todayVisible.length}</p>
          </div>
          <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-canvas-soft)] px-3 py-3">
            <div className="flex items-center gap-2 text-[var(--color-muted)]">
              <AlertTriangle className="h-4 w-4 text-[var(--color-copper)]" />
              <span className="text-[11px] uppercase tracking-[0.14em]">Overdue</span>
            </div>
            <p className="mt-2 text-2xl font-bold text-[var(--color-ink)]">{overdueVisible.length}</p>
          </div>
          <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-canvas-soft)] px-3 py-3">
            <div className="flex items-center gap-2 text-[var(--color-muted)]">
              <CheckCircle2 className="h-4 w-4 text-[var(--color-muted)]" />
              <span className="text-[11px] uppercase tracking-[0.14em]">Recent</span>
            </div>
            <p className="mt-2 text-2xl font-bold text-[var(--color-ink)]">{completedVisible.length}</p>
          </div>
        </div>
      </section>

      {batchError ? <p role="alert" className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-[var(--color-muted)]">{batchError}</p> : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <Card as="section" className="rounded-xl p-4 shadow-none sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="eyebrow">Overdue</p>
              <h2 className="mt-1 text-lg font-bold text-[var(--color-ink)]">Fix these first</h2>
            </div>
            {overdueVisible.length > 0 && (
              <Button
                type="button"
                disabled={batchLoading}
                onClick={() => batchAction(overdueVisible.map((t) => t.id))}
                variant="outline"
                size="sm"
                className="h-8 rounded-lg text-xs"
              >
                Mark all done
              </Button>
            )}
          </div>
          <div className="mt-4 grid gap-2">
            {overdueVisible.length > 0 ? (
              overdueVisible.map((task) => (
                <TaskCard key={task.id} task={task} plantName={plantMap.get(task.plantId)?.nickname ?? "Plant unavailable"} />
              ))
            ) : (
              <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-3 text-xs text-[var(--color-muted)]">No overdue tasks right now.</div>
            )}
          </div>
        </Card>

        <Card as="section" className="rounded-xl p-4 shadow-none sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="eyebrow">Today</p>
              <h2 className="mt-1 text-lg font-bold text-[var(--color-ink)]">Do these now</h2>
            </div>
            {todayVisible.length > 0 && (
              <Button
                type="button"
                disabled={batchLoading}
                onClick={() => batchAction(todayVisible.map((t) => t.id))}
                variant="outline"
                size="sm"
                className="h-8 rounded-lg text-xs"
              >
                Mark all done
              </Button>
            )}
          </div>
          <div className="mt-4 grid gap-2">
            {todayVisible.length > 0 ? (
              todayVisible.map((task) => (
                <TaskCard key={task.id} task={task} plantName={plantMap.get(task.plantId)?.nickname ?? "Plant unavailable"} />
              ))
            ) : (
              <div className="rounded-lg border border-[var(--color-line)] bg-white/5 px-3 py-3 text-xs text-[var(--color-muted)]">Nothing due today.</div>
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card as="section" className="rounded-xl p-4 shadow-none sm:p-5">
          <p className="eyebrow">Upcoming</p>
          <h2 className="mt-1 text-lg font-bold text-[var(--color-ink)]">Next scheduled care</h2>
          <p className="mt-1 text-xs text-[var(--color-muted)]">Open tasks due after today and within the queue window.</p>
          <div className="mt-4 grid gap-2">
            {upcomingVisible.length > 0 ? (
              upcomingVisible.slice(0, 12).map((task) => (
                <TaskCard key={task.id} task={task} plantName={plantMap.get(task.plantId)?.nickname ?? "Plant unavailable"} />
              ))
            ) : (
              <div className="rounded-lg border border-[var(--color-line)] bg-white/5 px-3 py-3 text-xs text-[var(--color-muted)]">Upcoming tasks will appear as the queue rolls forward.</div>
            )}
            {upcomingVisible.length > 12 ? <p className="text-xs text-[var(--color-muted)]">Showing the next 12 scheduled tasks.</p> : null}
          </div>
        </Card>

        <Card as="aside" className="rounded-xl p-4 shadow-none sm:p-5">
          <p className="eyebrow">Completed</p>
          <h2 className="mt-1 text-lg font-bold text-[var(--color-ink)]">Recent care</h2>
          <p className="mt-1 text-xs text-[var(--color-muted)]">The latest finished tasks stay visible here.</p>
          <div className="mt-4 grid gap-2">
            {completedVisible.length > 0 ? (
              completedVisible.map((task) => (
                <div key={task.id} className="rounded-lg border border-[var(--color-line)] bg-white/5 px-3 py-3">
                  <p className="text-xs font-semibold text-[var(--color-ink)]">{task.title}</p>
                  <p className="mt-1 text-[11px] text-[var(--color-muted)]">{plantMap.get(task.plantId)?.nickname ?? "Plant unavailable"}</p>
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-[var(--color-line)] bg-white/5 px-3 py-3 text-xs text-[var(--color-muted)]">Completed tasks will appear here.</div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
