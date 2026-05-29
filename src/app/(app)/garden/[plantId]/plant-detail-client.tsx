"use client";

import { useState, useTransition } from "react";
import type { PlantNote } from "@/lib/plant-notes";

const STAGES = ["seedling", "sprout", "growing", "mature", "flowering", "dormant"] as const;
type Stage = (typeof STAGES)[number];

type MilestoneItem = { id: string; stage: string; note: string | null; recordedAt: string };

const STAGE_COLORS: Record<Stage, string> = {
  seedling: "bg-[rgba(76,121,97,0.12)] text-[var(--color-moss)]",
  sprout: "bg-[rgba(76,121,97,0.16)] text-[var(--color-moss)]",
  growing: "bg-[rgba(76,121,97,0.2)] text-[var(--color-moss)]",
  mature: "bg-[rgba(76,121,97,0.25)] text-[var(--color-ink)]",
  flowering: "bg-[rgba(197,162,90,0.18)] text-[var(--color-gold)]",
  dormant: "bg-[rgba(16,52,39,0.08)] text-[var(--color-muted)]",
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
      <NotesPanel plantId={plantId} plantName={plantName} initialNotes={initialNotes} />
      <MilestonesPanel plantId={plantId} plantName={plantName} initialMilestones={initialMilestones} />
    </>
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
      <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-muted)]">Notes</p>
      <h3 className="mt-1 text-base font-semibold text-[var(--color-ink)]">Plant journal</h3>

      <div className="mt-4">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add an observation, reminder, or note..."
          rows={3}
          className="w-full resize-none rounded-xl border border-[rgba(16,52,39,0.12)] bg-white px-3 py-2.5 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-muted)] focus:border-[var(--color-moss)] focus:outline-none"
        />
        {error && <p className="mt-1 text-xs text-[var(--color-copper)]">{error}</p>}
        <button
          onClick={handleAdd}
          disabled={pending || !body.trim()}
          className="mt-2 rounded-lg bg-[var(--color-moss)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
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
                className="absolute right-2 top-2 rounded p-0.5 text-[var(--color-muted)] opacity-0 transition-opacity hover:text-[var(--color-copper)] group-hover:opacity-100"
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
      <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-muted)]">Growth</p>
      <h3 className="mt-1 text-base font-semibold text-[var(--color-ink)]">Milestones</h3>

      <div className="mt-4">
        <div className="flex flex-wrap gap-1.5">
          {STAGES.map((s) => (
            <button
              key={s}
              onClick={() => setStage(s)}
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize transition-all ${
                stage === s
                  ? STAGE_COLORS[s]
                  : "border border-[rgba(16,52,39,0.08)] bg-white text-[var(--color-muted)]"
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
          className="mt-2 w-full rounded-xl border border-[rgba(16,52,39,0.12)] bg-white px-3 py-2 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-muted)] focus:border-[var(--color-moss)] focus:outline-none"
        />
        {error && <p className="mt-1 text-xs text-[var(--color-copper)]">{error}</p>}
        <button
          onClick={handleRecord}
          disabled={pending}
          className="mt-2 rounded-lg bg-[var(--color-moss)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
        >
          {pending ? "Saving…" : "Record milestone"}
        </button>
      </div>

      {milestones.length > 0 && (
        <ol className="mt-4 space-y-2">
          {milestones.map((m) => (
            <li key={m.id} className="flex items-start gap-2">
              <span className={`mt-0.5 rounded-full px-2 py-0.5 text-xs capitalize ${STAGE_COLORS[m.stage as Stage] ?? "bg-[rgba(16,52,39,0.08)] text-[var(--color-muted)]"}`}>
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
