"use client";

import Link from "next/link";
import { useMemo, useState, useCallback } from "react";
import { TaskCard, type CareTask } from "@/components/garden/task-card";

type Plant = { id: string; nickname: string };

type TasksViewProps = {
  overdueTasks: CareTask[];
  dueTodayTasks: CareTask[];
  upcomingTasks: CareTask[];
  completedTasks: CareTask[];
  plantMap: [string, Plant][];
};

const KIND_OPTIONS = [
  { value: "all", label: "All types" },
  { value: "water", label: "Water" },
  { value: "inspect", label: "Inspect" },
  { value: "feed", label: "Feed" },
];

export function TasksView({ overdueTasks, dueTodayTasks, upcomingTasks, completedTasks, plantMap: plantMapEntries }: TasksViewProps) {
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState("all");
  const [batchLoading, setBatchLoading] = useState(false);
  const [localDone, setLocalDone] = useState<Set<string>>(new Set());
  const plantMap = new Map(plantMapEntries);

  const batchAction = useCallback(async (taskIds: string[], action: "done" | "skip") => {
    if (taskIds.length === 0) return;
    setBatchLoading(true);
    try {
      await fetch("/api/tasks/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskIds, action }),
      });
      setLocalDone((prev) => new Set([...prev, ...taskIds]));
    } finally {
      setBatchLoading(false);
    }
  }, []);

  const allActiveTasks = useMemo(
    () => [...overdueTasks, ...dueTodayTasks, ...upcomingTasks],
    [overdueTasks, dueTodayTasks, upcomingTasks],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allActiveTasks.filter((task) => {
      const name = (plantMap.get(task.plantId)?.nickname ?? "").toLowerCase();
      const title = task.title.toLowerCase();
      const matchesSearch = !q || name.includes(q) || title.includes(q);
      const matchesKind = kindFilter === "all" || task.kind === kindFilter;
      return matchesSearch && matchesKind;
    });
  }, [allActiveTasks, search, kindFilter, plantMap]);

  const overdueFiltered = filtered.filter((t) => overdueTasks.some((o) => o.id === t.id));
  const todayFiltered = filtered.filter((t) => dueTodayTasks.some((o) => o.id === t.id));
  const upcomingFiltered = filtered.filter((t) => upcomingTasks.some((o) => o.id === t.id));

  const isFiltering = search.trim() !== "" || kindFilter !== "all";

  return (
    <div className="grid gap-6">
      <section className="surface-panel px-5 py-6 sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm text-[var(--color-muted)]">Tasks</p>
            <h2 className="mt-2 text-2xl font-semibold text-[var(--color-ink)]">Care queue</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
              Overdue, due today, upcoming, and recently completed tasks.
            </p>
          </div>
          <Link href="/garden" className="button-secondary">Add more plants</Link>
        </div>

        {/* Search + filter bar */}
        <div className="mt-5 flex flex-wrap gap-3">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by plant or task…"
            className="h-9 min-w-[200px] flex-1 rounded-xl border border-[var(--color-line)] bg-white px-3 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-muted)] focus:border-[var(--color-canopy)]/40 focus:outline-none focus:ring-1 focus:ring-[var(--color-canopy)]/20"
          />
          <div className="flex gap-1.5">
            {KIND_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setKindFilter(opt.value)}
                className={`h-9 rounded-xl border px-3 text-xs font-medium transition ${
                  kindFilter === opt.value
                    ? "border-[var(--color-canopy)]/30 bg-[var(--color-canopy)] text-white"
                    : "border-[var(--color-line)] bg-white text-[var(--color-muted)] hover:bg-[var(--color-canvas-soft)]"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {isFiltering && (
            <button
              type="button"
              onClick={() => { setSearch(""); setKindFilter("all"); }}
              className="h-9 rounded-xl border border-[var(--color-line)] bg-white px-3 text-xs text-[var(--color-muted)] hover:text-[var(--color-ink)]"
            >
              Clear
            </button>
          )}
        </div>
        {isFiltering && (
          <p className="mt-2 text-xs text-[var(--color-muted)]">
            {filtered.length} {filtered.length === 1 ? "task" : "tasks"} match
          </p>
        )}
      </section>

      {isFiltering ? (
        <section className="surface-panel px-5 py-6 sm:px-6">
          <h3 className="text-lg font-semibold text-[var(--color-ink)]">Results</h3>
          <div className="mt-4 grid gap-4">
            {filtered.length > 0 ? (
              filtered.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  plantName={plantMap.get(task.plantId)?.nickname ?? "Plant unavailable"}
                  returnTo="/tasks"
                />
              ))
            ) : (
              <p className="rounded-xl border border-[var(--color-line)] bg-[var(--color-canvas-soft)] px-4 py-5 text-sm text-[var(--color-muted)]">
                No tasks match your search.
              </p>
            )}
          </div>
        </section>
      ) : (
        <>
          <div className="grid gap-6 xl:grid-cols-2">
            <section className="surface-panel px-5 py-6 sm:px-6">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-sm text-[var(--color-muted)]">Overdue</p>
                  <h3 className="mt-1 text-xl font-semibold text-[var(--color-ink)]">Recovery tasks</h3>
                </div>
                {overdueFiltered.filter((t) => !localDone.has(t.id)).length > 0 && (
                  <button
                    type="button"
                    disabled={batchLoading}
                    onClick={() => batchAction(overdueFiltered.filter((t) => !localDone.has(t.id)).map((t) => t.id), "done")}
                    className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 transition"
                  >
                    Mark all done
                  </button>
                )}
              </div>
              <div className="mt-5 grid gap-4">
                {overdueFiltered.filter((t) => !localDone.has(t.id)).length > 0 ? (
                  overdueFiltered.filter((t) => !localDone.has(t.id)).map((task) => (
                    <TaskCard key={task.id} task={task} plantName={plantMap.get(task.plantId)?.nickname ?? "Plant unavailable"} returnTo="/tasks" />
                  ))
                ) : (
                  <div className="surface-card px-4 py-4 text-sm text-[var(--color-moss)]">No overdue tasks right now.</div>
                )}
              </div>
            </section>

            <section className="surface-panel px-5 py-6 sm:px-6">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-sm text-[var(--color-muted)]">Today</p>
                  <h3 className="mt-1 text-xl font-semibold text-[var(--color-ink)]">Due now</h3>
                </div>
                {todayFiltered.filter((t) => !localDone.has(t.id)).length > 0 && (
                  <button
                    type="button"
                    disabled={batchLoading}
                    onClick={() => batchAction(todayFiltered.filter((t) => !localDone.has(t.id)).map((t) => t.id), "done")}
                    className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 transition"
                  >
                    Mark all done
                  </button>
                )}
              </div>
              <div className="mt-5 grid gap-4">
                {todayFiltered.filter((t) => !localDone.has(t.id)).length > 0 ? (
                  todayFiltered.filter((t) => !localDone.has(t.id)).map((task) => (
                    <TaskCard key={task.id} task={task} plantName={plantMap.get(task.plantId)?.nickname ?? "Plant unavailable"} returnTo="/tasks" />
                  ))
                ) : (
                  <div className="surface-card-muted px-4 py-4 text-sm text-[var(--color-muted)]">Nothing due today.</div>
                )}
              </div>
            </section>
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            <section className="surface-panel px-5 py-6 sm:px-6">
              <p className="text-sm text-[var(--color-muted)]">Upcoming</p>
              <h3 className="mt-1 text-xl font-semibold text-[var(--color-ink)]">Next scheduled care</h3>
              <div className="mt-5 grid gap-4">
                {upcomingFiltered.length > 0 ? (
                  upcomingFiltered.map((task) => (
                    <TaskCard key={task.id} task={task} plantName={plantMap.get(task.plantId)?.nickname ?? "Plant unavailable"} returnTo="/tasks" />
                  ))
                ) : (
                  <div className="surface-card-muted px-4 py-4 text-sm text-[var(--color-muted)]">Upcoming tasks will appear as the queue rolls forward.</div>
                )}
              </div>
            </section>

            <aside className="surface-panel px-5 py-6">
              <p className="text-sm text-[var(--color-muted)]">Completed</p>
              <h3 className="mt-1 text-xl font-semibold text-[var(--color-ink)]">Recent wins</h3>
              <div className="mt-5 grid gap-3">
                {completedTasks.length > 0 ? (
                  completedTasks.map((task) => (
                    <div key={task.id} className="surface-card px-4 py-4">
                      <p className="text-sm font-medium text-[var(--color-ink)]">{task.title}</p>
                      <p className="mt-2 text-sm text-[var(--color-muted)]">{plantMap.get(task.plantId)?.nickname ?? "Plant unavailable"}</p>
                    </div>
                  ))
                ) : (
                  <div className="surface-card px-4 py-4 text-sm text-[var(--color-muted)]">Completed tasks will appear here.</div>
                )}
              </div>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
