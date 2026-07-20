"use client";

import { useEffect, useState } from "react";

type SeasonalAdvice = {
  season: string;
  year: number;
  tips: string[];
  focusAreas: string[];
  warning?: string;
  generatedAt: string;
};

export function SeasonalCard() {
  const [advice, setAdvice] = useState<SeasonalAdvice | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/seasonal")
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((d) => setAdvice(d.advice))
      .catch(() => setError("Seasonal advice is unavailable right now."))
      .finally(() => setLoading(false));
  }, []);

  async function generate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/seasonal", { method: "POST" });
      if (!res.ok) throw new Error("Seasonal advice unavailable");
      const d = await res.json();
      setAdvice(d.advice);
    } catch {
      setError("Could not generate seasonal advice. Try again later.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5 shadow-[0_6px_20px_rgba(24,36,27,0.04)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="eyebrow">Seasonal care</p>
          {advice && (
            <p className="mt-1 text-lg font-semibold tracking-[-0.02em] text-[var(--color-ink)]">
              {advice.season.charAt(0).toUpperCase() + advice.season.slice(1)} {advice.year}
            </p>
          )}
        </div>
        <button
          onClick={generate}
          disabled={generating}
          className="shrink-0 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-ink)] transition hover:bg-[var(--color-canvas-soft)] disabled:opacity-50"
        >
          {generating ? "Generating…" : advice ? "Refresh" : "Generate"}
        </button>
      </div>

      {loading && <p className="text-sm text-[var(--color-muted)]">Loading…</p>}

      {error && <p role="alert" className="text-sm text-[var(--color-muted)]">{error}</p>}

      {!loading && !advice && (
        <p className="text-sm text-[var(--color-muted)]">
          Get personalized {new Date().toLocaleString("en-US", { month: "long" })} care tips for your garden.
        </p>
      )}

      {advice && (
        <div className="grid gap-3">
          {advice.warning && (
            <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-canvas-soft)] px-3 py-2 text-xs font-medium text-[var(--color-ink)]">
              {advice.warning}
            </div>
          )}

          {advice.focusAreas.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {advice.focusAreas.map((area) => (
                <span key={area} className="rounded-full border border-[var(--color-line)] bg-[var(--color-canvas-soft)] px-2.5 py-1 text-xs font-medium text-[var(--color-ink)]">
                  {area}
                </span>
              ))}
            </div>
          )}

          <ul className="grid gap-1.5">
            {advice.tips.map((tip, i) => (
              <li key={i} className="flex gap-2 text-sm text-[var(--color-ink)]">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-canopy)]" />
                <span>{tip}</span>
              </li>
            ))}
          </ul>

        </div>
      )}
    </div>
  );
}
