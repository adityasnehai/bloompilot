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

const SEASON_EMOJI: Record<string, string> = {
  spring: "🌸",
  summer: "☀️",
  fall: "🍂",
  winter: "❄️",
};

export function SeasonalCard() {
  const [advice, setAdvice] = useState<SeasonalAdvice | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetch("/api/seasonal")
      .then((r) => r.json())
      .then((d) => setAdvice(d.advice))
      .finally(() => setLoading(false));
  }, []);

  async function generate() {
    setGenerating(true);
    try {
      const res = await fetch("/api/seasonal", { method: "POST" });
      const d = await res.json();
      setAdvice(d.advice);
    } finally {
      setGenerating(false);
    }
  }

  const emoji = advice ? (SEASON_EMOJI[advice.season] ?? "🌿") : "🌿";

  return (
    <div className="rounded-2xl border border-[var(--color-line)] bg-white p-5 shadow-[0_2px_8px_rgba(20,52,39,0.06)]">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-muted)]">Seasonal tips</p>
          {advice && (
            <p className="text-base font-semibold text-[var(--color-ink)] mt-0.5">
              {emoji} {advice.season.charAt(0).toUpperCase() + advice.season.slice(1)} {advice.year}
            </p>
          )}
        </div>
        <button
          onClick={generate}
          disabled={generating}
          className="shrink-0 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-ink)] hover:bg-[rgba(20,52,39,0.06)] disabled:opacity-50 transition"
        >
          {generating ? "Generating…" : advice ? "Refresh" : "Generate"}
        </button>
      </div>

      {loading && <p className="text-sm text-[var(--color-muted)]">Loading…</p>}

      {!loading && !advice && (
        <p className="text-sm text-[var(--color-muted)]">
          Get personalized {new Date().toLocaleString("en-US", { month: "long" })} care tips for your garden.
        </p>
      )}

      {advice && (
        <div className="grid gap-3">
          {advice.warning && (
            <div className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-medium text-orange-700">
              ⚠️ {advice.warning}
            </div>
          )}

          {advice.focusAreas.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {advice.focusAreas.map((area) => (
                <span key={area} className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                  {area}
                </span>
              ))}
            </div>
          )}

          <ul className="grid gap-1.5">
            {advice.tips.map((tip, i) => (
              <li key={i} className="flex gap-2 text-sm text-[var(--color-ink)]">
                <span className="mt-0.5 shrink-0 text-[var(--color-canopy)]">•</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>

          <p className="text-[10px] text-[var(--color-muted)]">
            Generated {new Date(advice.generatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </p>
        </div>
      )}
    </div>
  );
}
