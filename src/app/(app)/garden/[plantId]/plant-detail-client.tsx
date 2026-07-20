"use client";

import { useState, useTransition, useEffect } from "react";
import type { PlantNote } from "@/lib/plant-notes";

const STAGES = ["seedling", "sprout", "growing", "mature", "flowering", "dormant"] as const;
type Stage = (typeof STAGES)[number];

type MilestoneItem = { id: string; stage: string; note: string | null; recordedAt: string };

const STAGE_COLORS: Record<Stage, string> = {
  seedling: "border-white/10 bg-white/5 text-[var(--color-muted)]",
  sprout: "border-white/10 bg-white/6 text-[var(--color-muted)]",
  growing: "border-white/12 bg-white/8 text-[var(--color-ink)]",
  mature: "border-white/14 bg-white/10 text-[var(--color-ink)]",
  flowering: "border-white/12 bg-white/8 text-[var(--color-ink)]",
  dormant: "border-white/10 bg-white/5 text-[var(--color-muted)]",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function PlantDetailClient({
  plantId,
  plantName,
  initialNotes,
  initialMilestones,
}: {
  plantId: string;
  plantName: string;
  initialNotes: PlantNote[];
  initialMilestones: MilestoneItem[];
}) {
  return (
    <>
      <QuickCarePanel plantId={plantId} plantName={plantName} />
      <HealthTrendPanel plantId={plantId} />
      <NotesPanel plantId={plantId} plantName={plantName} initialNotes={initialNotes} />
      <MilestonesPanel plantId={plantId} plantName={plantName} initialMilestones={initialMilestones} />
    </>
  );
}

const CARE_ACTIONS = [
  { type: "watered", label: "Watered", emoji: "💧" },
  { type: "fertilized", label: "Fertilized", emoji: "🌱" },
  { type: "inspected", label: "Inspected", emoji: "🔍" },
] as const;

function QuickCarePanel({ plantId, plantName }: { plantId: string; plantName: string }) {
  const [logging, setLogging] = useState<string | null>(null);
  const [logged, setLogged] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function logCare(eventType: string) {
    if (logging) return;
    setLogging(eventType);
    setError(null);
    try {
      const response = await fetch("/api/plants/log-care", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plantId, plantName, eventType }),
      });
      if (!response.ok) throw new Error("Care log failed");
      setLogged(eventType);
      setTimeout(() => setLogged(null), 2000);
    } catch {
      setError("Could not save this care event. Try again.");
    } finally {
      setLogging(null);
    }
  }

  return (
    <section className="surface-panel px-5 py-5 sm:px-6">
      <p className="eyebrow">Quick log</p>
      <h3 className="mt-1 text-base font-semibold text-[var(--color-ink)]">Log care today</h3>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {CARE_ACTIONS.map((action) => (
          <button
            key={action.type}
            type="button"
            onClick={() => logCare(action.type)}
            disabled={!!logging}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition disabled:opacity-60 ${
              logged === action.type
                ? "border-white/14 bg-white/10 text-[var(--color-ink)]"
                : "border-[var(--color-line)] bg-white/5 text-[var(--color-muted)] hover:border-white/20 hover:text-[var(--color-ink)]"
            }`}
          >
            {logging === action.type ? "…" : action.emoji} {logged === action.type ? "Logged!" : action.label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-[var(--color-muted)]">Updates the care timeline and health history.</p>
      {error ? <p role="alert" className="mt-2 text-xs text-[var(--color-muted)]">{error}</p> : null}
    </section>
  );
}

type TrendPoint = { date: string; score: number };

function HealthTrendPanel({ plantId }: { plantId: string }) {
  const [trend, setTrend] = useState<TrendPoint[] | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/plants/trend?plantId=${encodeURIComponent(plantId)}`)
      .then((r) => r.json())
      .then((data: { trend: TrendPoint[] }) => { if (active) setTrend(data.trend ?? []); })
      .catch(() => { if (active) setTrend([]); });
    return () => { active = false; };
  }, [plantId]);

  if (trend !== null && trend.length === 0) return null;

  const W = 260;
  const H = 56;
  const pad = 4;

  return (
    <section className="surface-panel px-5 py-5 sm:px-6">
      <p className="eyebrow">Trend</p>
      <h3 className="mt-1 text-base font-semibold text-[var(--color-ink)]">14-day health</h3>
      {trend === null ? (
        <p className="mt-3 text-sm text-[var(--color-muted)]">Loading trend…</p>
      ) : (() => {
        const points = trend.map((p, i) => {
          const x = pad + (i / Math.max(1, trend.length - 1)) * (W - pad * 2);
          const y = H - pad - (p.score / 100) * (H - pad * 2);
          return `${x},${y}`;
        });
        const polyline = points.join(" ");
        const last = trend[trend.length - 1].score;
        const color = last >= 75 ? "#10b981" : last >= 50 ? "#f59e0b" : "#ef4444";
        const [lx, ly] = points[points.length - 1].split(",");
        return (
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-[var(--color-muted)]">
              <span>Latest score</span>
              <span className="font-semibold" style={{ color }}>{last}/100</span>
            </div>
            <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full" style={{ height: H }}>
              <defs>
                <linearGradient id={`grad-${plantId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity="0.2" />
                  <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
              </defs>
              <polygon points={`${pad},${H} ${polyline} ${W - pad},${H}`} fill={`url(#grad-${plantId})`} />
              <polyline points={polyline} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
              <circle cx={lx} cy={ly} r="3" fill={color} />
            </svg>
          </div>
        );
      })()}
    </section>
  );
}

function NotesPanel({
  plantId,
  plantName,
  initialNotes,
}: {
  plantId: string;
  plantName: string;
  initialNotes: PlantNote[];
}) {
  const [notes, setNotes] = useState<PlantNote[]>(initialNotes);
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleAdd() {
    if (!body.trim()) return;
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/plants/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plantId, plantName, body: body.trim() }),
      });
      if (!res.ok) { setError("Failed to save note"); return; }
      const data = (await res.json()) as { note: PlantNote };
      setNotes((prev) => [data.note, ...prev]);
      setBody("");
    });
  }

  function handleDelete(noteId: string) {
    startTransition(async () => {
      await fetch(`/api/plants/notes?noteId=${noteId}`, { method: "DELETE" });
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
    });
  }

  return (
    <section className="surface-panel px-5 py-5 sm:px-6">
      <p className="eyebrow">Notes</p>
      <h3 className="mt-1 text-base font-semibold text-[var(--color-ink)]">Plant journal</h3>

      <div className="mt-4">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add an observation, reminder, or note..."
          rows={3}
          className="w-full resize-none rounded-xl border border-[var(--color-line)] bg-white/5 px-3 py-2.5 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-muted)] focus:border-white/20 focus:outline-none"
        />
        {error && <p className="mt-1 text-xs text-[var(--color-muted)]">{error}</p>}
        <button
          onClick={handleAdd}
          disabled={pending || !body.trim()}
          className="mt-2 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-black disabled:opacity-50"
        >
          {pending ? "Saving…" : "Add note"}
        </button>
      </div>

      {notes.length > 0 && (
        <ol className="mt-4 space-y-2">
          {notes.map((note) => (
            <li key={note.id} className="surface-card-muted group relative px-3 py-3">
              <p className="pr-6 text-sm leading-6 text-[var(--color-ink)]">{note.body}</p>
              <p className="mt-1 text-xs text-[var(--color-muted)]">{fmtDate(note.createdAt)}</p>
              <button
                onClick={() => handleDelete(note.id)}
                className="absolute right-2 top-2 rounded p-0.5 text-[var(--color-muted)] opacity-0 transition-opacity hover:text-[var(--color-ink)] group-hover:opacity-100"
                title="Delete note"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-3.5 w-3.5">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14H6L5 6" />
                  <path d="M10 11v6M14 11v6" />
                  <path d="M9 6V4h6v2" />
                </svg>
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function MilestonesPanel({
  plantId,
  plantName,
  initialMilestones,
}: {
  plantId: string;
  plantName: string;
  initialMilestones: MilestoneItem[];
}) {
  const [milestones, setMilestones] = useState<MilestoneItem[]>(initialMilestones);
  const [stage, setStage] = useState<Stage>("growing");
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleRecord() {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/plants/milestones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plantId, plantName, stage, note: note.trim() || undefined }),
      });
      if (!res.ok) { setError("Failed to record milestone"); return; }
      const data = (await res.json()) as { milestone: { id: string; stage: string; note: string | null; recordedAt: string } };
      const m = data.milestone;
      setMilestones((prev) => [{ id: m.id, stage: m.stage, note: m.note, recordedAt: m.recordedAt }, ...prev]);
      setNote("");
    });
  }

  return (
    <section className="surface-panel px-5 py-5 sm:px-6">
      <p className="eyebrow">Growth</p>
      <h3 className="mt-1 text-base font-semibold text-[var(--color-ink)]">Milestones</h3>

      <div className="mt-4">
        <div className="flex flex-wrap gap-1.5">
          {STAGES.map((s) => (
            <button
              key={s}
              onClick={() => setStage(s)}
              className={`rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize transition-all ${
                stage === s
                  ? STAGE_COLORS[s]
                  : "border-[var(--color-line)] bg-white/5 text-[var(--color-muted)]"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional note…"
          className="mt-2 w-full rounded-xl border border-[var(--color-line)] bg-white/5 px-3 py-2 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-muted)] focus:border-white/20 focus:outline-none"
        />
        {error && <p className="mt-1 text-xs text-[var(--color-muted)]">{error}</p>}
        <button
          onClick={handleRecord}
          disabled={pending}
          className="mt-2 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-black disabled:opacity-50"
        >
          {pending ? "Saving…" : "Record milestone"}
        </button>
      </div>

      {milestones.length > 0 && (
        <ol className="mt-4 space-y-2">
          {milestones.map((m) => (
            <li key={m.id} className="flex items-start gap-2">
              <span className={`mt-0.5 rounded-full border px-2 py-0.5 text-xs capitalize ${STAGE_COLORS[m.stage as Stage] ?? "border-white/10 bg-white/5 text-[var(--color-muted)]"}`}>
                {m.stage}
              </span>
              <div className="flex-1 min-w-0">
                {m.note && <p className="text-sm text-[var(--color-ink)]">{m.note}</p>}
                <p className="text-xs text-[var(--color-muted)]">{fmtDate(m.recordedAt)}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
