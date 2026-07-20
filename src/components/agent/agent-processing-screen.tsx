"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type StepStatus = "pending" | "running" | "done" | "failed";

type Step = {
  id: string;
  title: string;
  detail: string;
  status: StepStatus;
};

const INITIAL_STEPS: Step[] = [
  { id: "context", title: "Your garden", detail: "Reading your profile, location, and plants.", status: "running" },
  { id: "environment", title: "Local conditions", detail: "Checking today’s weather and garden conditions.", status: "pending" },
  { id: "knowledge", title: "Plant care", detail: "Matching each plant with its care needs.", status: "pending" },
  { id: "planner", title: "Today’s care plan", detail: "Choosing the most useful actions for today.", status: "pending" },
  { id: "evidence", title: "Final check", detail: "Checking that recommendations are grounded and safe.", status: "pending" },
];

export function AgentProcessingScreen() {
  const router = useRouter();
  const [steps, setSteps] = useState<Step[]>(INITIAL_STEPS);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const es = new EventSource("/api/care-plan/stream");

    function setStepStatus(id: string, status: StepStatus) {
      setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)));
    }

    es.addEventListener("steps", (e: MessageEvent<string>) => {
      try {
        const data = JSON.parse(e.data) as { steps?: Step[] };
        if (Array.isArray(data.steps) && data.steps.length > 0) setSteps(data.steps);
      } catch {
        setError("The setup update was unreadable. Please retry.");
      }
    });

    es.addEventListener("step_update", (e: MessageEvent<string>) => {
      const data = JSON.parse(e.data) as { id: string; status: StepStatus };
      setStepStatus(data.id, data.status);
    });

    es.addEventListener("done", () => {
      es.close();
      router.replace("/dashboard");
    });

    es.addEventListener("error", (e: MessageEvent<string>) => {
      es.close();
      try {
        const data = JSON.parse(e.data) as { message?: string };
        setError(data.message ?? "Agent run failed. Please retry.");
      } catch {
        setError("Agent run failed. Please retry.");
      }
      setSteps((prev) =>
        prev.map((s) => (s.status === "running" ? { ...s, status: "failed" } : s)),
      );
    });

    es.onerror = () => {
      es.close();
      setError("Connection to the setup service was lost. Please retry.");
      setSteps((prev) =>
        prev.map((s) => (s.status === "running" ? { ...s, status: "failed" } : s)),
      );
    };

    return () => {
      es.close();
    };
  }, [router]);

  const completedCount = useMemo(
    () => steps.filter((step) => step.status === "done").length,
    [steps],
  );
  const progressPercent = steps.length > 0 ? Math.round((completedCount / steps.length) * 100) : 0;

  return (
    <main className="app-shell flex min-h-screen items-center justify-center px-4 py-10">
      <section className="mx-auto w-full max-w-[760px] rounded-[28px] border border-[var(--color-line)] bg-[var(--color-surface)] px-6 py-7 shadow-[0_18px_40px_rgba(24,36,27,0.1)] sm:px-8 sm:py-8">
        <p className="eyebrow">Almost ready</p>
        <h1 className="font-accent mt-2 text-[2rem] font-semibold leading-[1.02] text-[var(--color-ink)] sm:text-[2.3rem]">
          Setting up your garden dashboard.
        </h1>
        <p className="landing-copy mt-3 text-[15px]">
          We’re checking your plants and today’s conditions so your first care actions fit your garden.
        </p>

        <div className="mt-6">
          <div className="h-2.5 overflow-hidden rounded-full bg-[var(--color-canvas-soft)]">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,var(--color-canopy),var(--color-primary-hover))] transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
            <div className="mt-2 flex items-center justify-between text-xs text-[var(--color-muted)]">
              <span>{progressPercent}% ready</span>
              <span>{progressPercent === 100 ? "Finishing up" : "This usually takes a moment"}</span>
            </div>
          </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[var(--color-canvas-soft)]">
          {steps.map((step) => (
              <article
                key={step.id}
                className="flex items-center gap-3 border-b border-[var(--color-line)] px-4 py-3 last:border-b-0"
              >
                <span
                  aria-hidden="true"
                  className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                      step.status === "done"
                        ? "bg-[var(--color-canvas-mint)] text-[var(--color-ink)]"
                        : step.status === "running"
                          ? "bg-[var(--color-canvas-mint)] text-[var(--color-ink)]"
                            : step.status === "failed"
                            ? "bg-[var(--color-canvas-mint)] text-[var(--color-ink)]"
                              : "bg-[var(--color-surface)] text-[var(--color-muted)]"
                    }`}
                >
                  {step.status === "done" ? "✓" : step.status === "failed" ? "!" : step.status === "running" ? "•" : ""}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-accent text-sm font-semibold text-[var(--color-ink)]">{step.title}</p>
                  <p className="mt-0.5 text-xs text-[var(--color-muted)]">{step.detail}</p>
                </div>
                <span className="shrink-0 text-xs font-medium text-[var(--color-muted)]">
                  {step.status === "done" ? "Ready" : step.status === "running" ? "Checking…" : step.status === "failed" ? "Needs attention" : "Next"}
                </span>
              </article>
            ))}
        </div>

        {error ? (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--color-line)] bg-[var(--color-canvas-soft)] px-4 py-3 text-sm text-[var(--color-muted)]">
            <span>We couldn’t finish setting up your dashboard. Your garden data is safe.</span>
            <button type="button" onClick={() => window.location.reload()} className="font-medium text-[var(--color-canopy)] underline underline-offset-4">
              Try again
            </button>
          </div>
        ) : null}
      </section>
    </main>
  );
}
