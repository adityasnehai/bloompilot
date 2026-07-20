"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Droplets, Eye, Leaf, Sprout } from "lucide-react";
import { Card } from "@/components/ui/card";

type TaskKind = "water" | "inspect" | "feed";
type TaskStatus = "open" | "done";

export type CareTask = {
  id: string;
  plantId: string;
  title: string;
  kind: TaskKind;
  status: TaskStatus;
  dueDate: string;
  createdAt: string;
  completedAt?: string;
};

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(value));
}

function describeTaskTiming(value: string) {
  const now = new Date();
  const todayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const due = new Date(value);
  const dueStart = Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate());
  const diff = Math.round((dueStart - todayStart) / 86400000);
  if (diff < 0) return `${Math.abs(diff)} day${Math.abs(diff) === 1 ? "" : "s"} overdue`;
  if (diff === 0) return "Due today";
  if (diff === 1) return "Due tomorrow";
  return `Due in ${diff} days`;
}

function TaskIcon({ kind }: { kind: TaskKind }) {
  const Icon = kind === "water" ? Droplets : kind === "inspect" ? Eye : kind === "feed" ? Sprout : Leaf;
  return <Icon className="h-4 w-4" strokeWidth={1.8} />;
}

function taskKindLabel(kind: TaskKind) {
  if (kind === "water") return "Water";
  if (kind === "feed") return "Feed";
  return "Inspect";
}

type TaskCardProps = {
  task: CareTask;
  plantName: string;
};

export function TaskCard({ task, plantName }: TaskCardProps) {
  const completed = task.status === "done";
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggleTask() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/tasks/${encodeURIComponent(task.id)}/toggle`, { method: "POST" });
      if (!response.ok) throw new Error("Could not update task");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not update task");
      setPending(false);
    }
  }

  return (
    <Card as="article" className="rounded-xl p-3 shadow-none">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
        <div className="min-w-0">
          <div className="flex items-start gap-3">
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${completed ? "border-[var(--color-line)] bg-[var(--color-canvas-soft)] text-[var(--color-muted)]" : "border-[var(--color-line)] bg-white/70 text-[var(--color-ink)]"}`}>
              <TaskIcon kind={task.kind} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/garden/${encodeURIComponent(task.plantId)}`} className="max-w-full truncate text-[11px] font-semibold text-[var(--color-muted)] hover:text-[var(--color-ink)] hover:underline">
                  {plantName}
                </Link>
                <span className="rounded-full border border-[var(--color-line)] bg-[var(--color-canvas-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-muted)]">
                  {taskKindLabel(task.kind)}
                </span>
              </div>
              <h3 className="mt-1 truncate text-sm font-semibold text-[var(--color-ink)]">{task.title}</h3>
              <p className="mt-1 text-[11px] text-[var(--color-muted)]">Due {formatShortDate(task.dueDate)}</p>
            </div>
          </div>
        </div>
        <div className="flex items-start gap-2 sm:flex-col sm:items-end">
          <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${completed ? "border-[var(--color-line)] bg-[var(--color-canvas-soft)] text-[var(--color-ink)]" : "border-[var(--color-line)] bg-white/70 text-[var(--color-muted)]"}`}>
            {completed ? "Done" : describeTaskTiming(task.dueDate)}
          </span>
          <button
            type="button"
            onClick={toggleTask}
            disabled={pending}
            className={`inline-flex h-8 items-center justify-center rounded-lg px-3 text-xs font-semibold transition ${
              completed
                ? "border border-[var(--color-line)] bg-[var(--color-canvas-soft)] text-[var(--color-ink)] hover:border-[var(--color-copper)]/35 hover:bg-[rgba(182,61,61,0.08)] hover:text-[var(--color-copper)]"
                : "bg-[var(--color-canopy)] text-white hover:bg-[var(--color-primary-hover)]"
            } disabled:cursor-wait disabled:opacity-60`}
          >
            {pending ? "Saving…" : completed ? "Reopen" : "Mark done"}
          </button>
        </div>
      </div>
      {error ? <p role="alert" className="mt-3 text-xs text-[var(--color-muted)]">{error}. Try again.</p> : null}
    </Card>
  );
}
