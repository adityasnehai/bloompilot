"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useStudioStore, getSun, ZONE_META } from "./studio-store";

// ── Time-of-day label ─────────────────────────────────────────────────────────
function timeLabel(h: number): string {
  const period = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:00 ${period}`;
}

// ── Sun indicator ─────────────────────────────────────────────────────────────
function SunIndicator({ hour }: { hour: number }) {
  const sun = getSun(hour);
  const t = Math.max(0, Math.min(1, (hour - 5.5) / 13));

  const label =
    !sun.isDay          ? "Night"
    : hour < 8          ? "Sunrise"
    : hour < 10         ? "Morning"
    : hour < 14         ? "Midday"
    : hour < 17         ? "Afternoon"
    : hour < 19         ? "Sunset"
    : "Dusk";

  const dotColor =
    !sun.isDay          ? "#334155"
    : hour < 8 || hour > 18 ? "#f97316"
    : hour < 10 || hour > 16 ? "#fbbf24"
    : "#fef3c7";

  return (
    <div className="flex items-center gap-2">
      <div
        className="h-4 w-4 rounded-full shadow-lg"
        style={{
          background: dotColor,
          boxShadow: sun.isDay ? `0 0 8px 2px ${dotColor}88` : undefined,
        }}
      />
      <span className="text-xs font-semibold text-white">{label}</span>
      <span className="text-xs text-white/45">{timeLabel(hour)}</span>
    </div>
  );
}

// ── Zone legend ───────────────────────────────────────────────────────────────
function ZoneLegend() {
  const showZones = useStudioStore((s) => s.showZones);
  if (!showZones) return null;

  return (
    <div className="flex items-center gap-3">
      {(["full_sun", "partial_shade", "shade"] as const).map((z) => {
        const { emoji, label, color } = ZONE_META[z];
        return (
          <div key={z} className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-sm" style={{ background: color, opacity: 0.85 }} />
            <span className="text-xs text-white/55">{emoji} {label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Save button ───────────────────────────────────────────────────────────────
function SaveButton() {
  const placed = useStudioStore((s) => s.placed);

  async function handleSave() {
    if (placed.length === 0) return;
    try {
      await Promise.all(
        placed.map((p) =>
          fetch("/api/plants", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              nickname: p.commonName,
              species: p.species,
              placement: "balcony",
              sunlight: p.lightReq === "full_sun" ? "full_sun" : p.lightReq === "partial_shade" ? "partial_sun" : "shade",
              wateringIntervalDays: 5,
            }),
          }),
        ),
      );
      alert(`Saved ${placed.length} plant${placed.length !== 1 ? "s" : ""} to your garden.`);
    } catch {
      alert("Save failed. Please try again.");
    }
  }

  return (
    <button
      onClick={handleSave}
      disabled={placed.length === 0}
      className="flex items-center gap-2 rounded-xl bg-green-500 px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-green-400 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
        <polyline points="17 21 17 13 7 13 7 21" />
        <polyline points="7 3 7 8 15 8" />
      </svg>
      Save to Garden {placed.length > 0 && `(${placed.length})`}
    </button>
  );
}

// ── Header bar ────────────────────────────────────────────────────────────────
export function StudioHeader() {
  const showZones  = useStudioStore((s) => s.showZones);
  const toggleZones = useStudioStore((s) => s.toggleZones);
  const setPending = useStudioStore((s) => s.setPending);

  // ESC to cancel placement
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPending(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setPending]);

  return (
    <header className="flex shrink-0 items-center justify-between gap-4 px-5 py-3 border-b border-white/10">
      {/* Left: brand + title */}
      <div className="flex items-center gap-3">
        <Link
          href="/garden"
          className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-white/40 hover:bg-white/8 hover:text-white/70 transition"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
          Back
        </Link>
        <div className="h-4 w-px bg-white/15" />
        <span className="text-sm font-semibold text-white">Balcony Garden Studio</span>
        <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-green-400">
          Beta
        </span>
      </div>

      {/* Right: controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={toggleZones}
          className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition-all ${
            showZones
              ? "border-white/25 bg-white/12 text-white"
              : "border-white/10 bg-white/5 text-white/50 hover:border-white/20 hover:text-white/70"
          }`}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="5" />
            <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
          </svg>
          Light Zones
        </button>
        <SaveButton />
      </div>
    </header>
  );
}

// ── Bottom time controls ──────────────────────────────────────────────────────
export function StudioFooter() {
  const sunHour   = useStudioStore((s) => s.sunHour);
  const setSunHour = useStudioStore((s) => s.setSunHour);

  return (
    <footer className="shrink-0 border-t border-white/10 px-6 py-4">
      <div className="flex flex-col gap-3">
        {/* Time info row */}
        <div className="flex items-center justify-between">
          <SunIndicator hour={sunHour} />
          <ZoneLegend />
        </div>

        {/* Slider row */}
        <div className="flex items-center gap-4">
          <span className="text-xs text-white/35">5 AM</span>
          <div className="relative flex-1">
            <input
              type="range"
              min={5}
              max={21}
              step={0.5}
              value={sunHour}
              onChange={(e) => setSunHour(Number(e.target.value))}
              className="sun-slider w-full"
            />
            {/* Gradient track overlay */}
            <div
              className="pointer-events-none absolute inset-y-0 left-0 right-0 rounded-full opacity-30"
              style={{
                background:
                  "linear-gradient(to right, #1e293b 0%, #f97316 12%, #fbbf24 25%, #fef3c7 50%, #fbbf24 75%, #f97316 88%, #1e293b 100%)",
              }}
            />
          </div>
          <span className="text-xs text-white/35">9 PM</span>
        </div>

        <p className="text-center text-xs text-white/30">
          Drag the slider to see how light zones shift throughout the day
        </p>
      </div>
    </footer>
  );
}
