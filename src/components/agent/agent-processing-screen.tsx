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

export function AgentProcessingScreen() {
  const router = useRouter();
  const [steps, setSteps] = useState<Step[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const es = new EventSource("/api/care-plan/stream");

    function setStepStatus(id: string, status: StepStatus) {
      setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)));
    }

    es.addEventListener("steps", (e: MessageEvent<string>) => {
      const data = JSON.parse(e.data) as { steps: Step[] };
      setSteps(data.steps);
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
      setError("Connection to agent stream was lost. Please retry.");
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
    <main className="landing-root flex min-h-screen items-center justify-center px-4 py-10">
      <section className="mx-auto w-full max-w-[760px] rounded-[28px] border border-[rgba(220,231,218,0.9)] bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(244,248,241,0.96)_100%)] px-6 py-7 shadow-[0_18px_40px_rgba(48,65,22,0.08)] sm:px-8 sm:py-8">
        <p className="eyebrow">Preparing dashboard</p>
        <h1 className="font-accent mt-2 text-[2rem] font-semibold leading-[1.02] text-[#173528] sm:text-[2.3rem]">
          BloomPilot agents are building your care workspace.
        </h1>
        <p className="landing-copy mt-3 text-[15px]">
          We are running context, environment, and planning agents so your first dashboard is ready with reliable actions.
        </p>

        <div className="mt-6">
          <div className="h-2.5 overflow-hidden rounded-full bg-[#e7efe4]">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,#173528,#5f8a52)] transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-[#5f7568]">{progressPercent}% complete</p>
        </div>

        <div className="mt-6 grid gap-3">
          {steps.length === 0 ? (
            <p className="text-sm text-[#647b6f]">Connecting to agent stream…</p>
          ) : (
            steps.map((step) => (
              <article
                key={step.id}
                className="rounded-2xl border border-[#dce7da] bg-white/88 px-4 py-3"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-accent text-sm font-semibold text-[#173528]">
                      {step.title}
                    </p>
                    <p className="mt-1 text-xs text-[#647b6f]">{step.detail}</p>
                  </div>
                  <span
                    className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      step.status === "done"
                        ? "bg-[#eaf4df] text-[#3b6a35]"
                        : step.status === "running"
                          ? "bg-[#eef4e4] text-[#556f45]"
                          : step.status === "failed"
                            ? "bg-[#fde9e6] text-[#a1452e]"
                            : "bg-[#f2f4f1] text-[#6c7b72]"
                    }`}
                  >
                    {step.status === "done"
                      ? "Done"
                      : step.status === "running"
                        ? "Running…"
                        : step.status === "failed"
                          ? "Failed"
                          : "Queued"}
                  </span>
                </div>
              </article>
            ))
          )}
        </div>

        {error ? (
          <div className="mt-5 rounded-2xl border border-[#f2c9bf] bg-[#fff4f1] px-4 py-3 text-sm text-[#8f3f2a]">
            {error}
          </div>
        ) : null}
      </section>
    </main>
  );
}
