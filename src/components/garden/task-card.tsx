"use client";

import { useState } from "react";
import { toggleTaskAction } from "@/app/garden-actions";

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
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(value));
}

function describeTaskTiming(value: string) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const dueStart = new Date(value);
  dueStart.setHours(0, 0, 0, 0);
  const diff = Math.round((dueStart.getTime() - todayStart.getTime()) / 86400000);
  if (diff < 0) return `${Math.abs(diff)} day${Math.abs(diff) === 1 ? "" : "s"} overdue`;
  if (diff === 0) return "Due today";
  if (diff === 1) return "Due tomorrow";
  return `Due in ${diff} days`;
}

type TaskCardProps = {
  task: CareTask;
  plantName: string;
  returnTo: string;
};

export function TaskCard({ task, plantName, returnTo }: TaskCardProps) {
  const completed = task.status === "done";
  const [feedback, setFeedback] = useState<"positive" | "negative" | null>(null);

  async function submitFeedback(value: "positive" | "negative") {
    if (feedback === value) return;
    setFeedback(value);
    await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        plantName,
        actionType: task.kind,
        actionTitle: task.title,
        feedback: value,
      }),
    }).catch(() => null);
  }

  return (
    <article className="surface-card p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-[var(--color-muted)]">{plantName}</p>
          <h3 className="mt-1 text-base font-semibold text-[var(--color-ink)]">
            {task.title}
          </h3>
        </div>
        <span className="text-sm text-[var(--color-muted)]">
          {completed ? "Completed" : describeTaskTiming(task.dueDate)}
        </span>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-sm text-[var(--color-muted)]">
          Due {formatShortDate(task.dueDate)}
        </p>
        <div className="flex items-center gap-2">
          {completed && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-[var(--color-muted)]">Helpful?</span>
              {(["positive", "negative"] as const).map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => submitFeedback(val)}
                  className={`inline-flex h-7 w-7 items-center justify-center rounded-full border text-sm transition ${
                    feedback === val
                      ? val === "positive"
                        ? "border-emerald-300 bg-emerald-50 text-emerald-600"
                        : "border-red-300 bg-red-50 text-red-500"
                      : "border-[var(--color-line)] bg-white text-[var(--color-muted)] hover:border-[var(--color-canopy)]/30"
                  }`}
                >
                  {val === "positive" ? "👍" : "👎"}
                </button>
              ))}
            </div>
          )}
          <form action={toggleTaskAction}>
            <input type="hidden" name="taskId" value={task.id} />
            <input type="hidden" name="returnTo" value={returnTo} />
            <button
              type="submit"
              className={`inline-flex h-10 items-center justify-center rounded-2xl px-4 text-sm font-medium ${
                completed ? "button-secondary" : "button-primary"
              }`}
            >
              {completed ? "Reopen" : "Mark done"}
            </button>
          </form>
        </div>
      </div>
    </article>
  );
}
