"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useStudioStore, type LightReq, type PendingPlant, ZONE_META } from "./studio-store";

type SearchResult = {
  commonName: string;
  species: string;
  imageUrl?: string;
};

const LIGHT_BTNS: { req: LightReq; icon: string; label: string }[] = [
  { req: "full_sun",      icon: "☀️",  label: "Full Sun"      },
  { req: "partial_shade", icon: "⛅", label: "Partial Shade" },
  { req: "shade",         icon: "🌑", label: "Shade"         },
];

function LightToggle({
  value,
  onChange,
}: {
  value: LightReq;
  onChange: (v: LightReq) => void;
}) {
  return (
    <div className="flex gap-1 mt-1">
      {LIGHT_BTNS.map(({ req, icon, label }) => (
        <button
          key={req}
          title={label}
          onClick={(e) => { e.stopPropagation(); onChange(req); }}
          className={`flex-1 rounded-md py-1 text-xs font-medium transition-all ${
            value === req
              ? "bg-white/20 text-white ring-1 ring-white/40"
              : "text-white/50 hover:text-white/80"
          }`}
        >
          {icon}
        </button>
      ))}
    </div>
  );
}

function PlantCard({
  result,
  lightReq,
  onLightChange,
  onPlace,
  isPending,
}: {
  result: SearchResult;
  lightReq: LightReq;
  onLightChange: (v: LightReq) => void;
  onPlace: () => void;
  isPending: boolean;
}) {
  return (
    <div
      onClick={onPlace}
      className={`group relative cursor-pointer rounded-xl border transition-all ${
        isPending
          ? "border-green-400/60 bg-white/15 ring-1 ring-green-400/40"
          : "border-white/10 bg-white/6 hover:border-white/25 hover:bg-white/12"
      }`}
    >
      <div className="flex gap-3 p-3">
        {/* Thumbnail */}
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-white/10">
          {result.imageUrl ? (
            <img
              src={result.imageUrl}
              alt={result.commonName}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-2xl">🌿</div>
          )}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white leading-tight">
            {result.commonName}
          </p>
          <p className="truncate text-xs text-white/45 italic mt-0.5">
            {result.species}
          </p>
          <LightToggle value={lightReq} onChange={onLightChange} />
        </div>
      </div>

      {/* Place badge */}
      <div
        className={`absolute right-2.5 top-2.5 rounded-full px-2 py-0.5 text-xs font-medium transition-all ${
          isPending
            ? "bg-green-400 text-green-900"
            : "bg-white/0 text-white/0 group-hover:bg-white/15 group-hover:text-white/80"
        }`}
      >
        {isPending ? "Placing…" : "Place"}
      </div>
    </div>
  );
}

function PlacedList() {
  const placed   = useStudioStore((s) => s.placed);
  const activeId = useStudioStore((s) => s.activeId);
  const remove   = useStudioStore((s) => s.removePlant);
  const setActive = useStudioStore((s) => s.setActive);

  if (placed.length === 0) return null;

  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/40">
        Placed Plants ({placed.length})
      </p>
      <div className="flex flex-col gap-1.5">
        {placed.map((p) => (
          <div
            key={p.id}
            onClick={() => setActive(activeId === p.id ? null : p.id)}
            className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 transition-all ${
              activeId === p.id
                ? "bg-white/15 ring-1 ring-white/25"
                : "bg-white/5 hover:bg-white/10"
            }`}
          >
            {p.imageUrl ? (
              <img src={p.imageUrl} alt={p.commonName} className="h-8 w-8 rounded-md object-cover shrink-0" />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-white/10 text-lg shrink-0">🌿</div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-white">{p.commonName}</p>
              <p className="text-xs text-white/40">{ZONE_META[p.lightReq].emoji} {ZONE_META[p.lightReq].label}</p>
            </div>
            {activeId === p.id && (
              <button
                onClick={(e) => { e.stopPropagation(); remove(p.id); }}
                className="ml-1 shrink-0 rounded-md p-1 text-red-400/80 hover:bg-red-500/20 hover:text-red-400 transition-colors"
                title="Remove plant"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────
export function PlantPanel() {
  const [query, setQuery]       = useState("");
  const [results, setResults]   = useState<SearchResult[]>([]);
  const [loading, setLoading]   = useState(false);
  const [lightReqs, setLightReqs] = useState<Record<string, LightReq>>({});
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pending    = useStudioStore((s) => s.pending);
  const setPending = useStudioStore((s) => s.setPending);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/plants/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data.results ?? []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query.trim()), 320);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, search]);

  function getLightReq(key: string): LightReq {
    return lightReqs[key] ?? "partial_shade";
  }

  function handlePlace(result: SearchResult) {
    const key = `${result.commonName}::${result.species}`;
    const lightReq = getLightReq(key);
    const plant: PendingPlant = { ...result, lightReq };

    if (pending?.commonName === result.commonName && pending?.species === result.species) {
      setPending(null);
    } else {
      setPending(plant);
    }
  }

  const isPendingResult = (r: SearchResult) =>
    pending?.commonName === r.commonName && pending?.species === r.species;

  return (
    <aside className="flex h-full w-[300px] shrink-0 flex-col gap-4 overflow-y-auto p-4">
      {/* Header */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-white/35">
          Plant Library
        </p>
        <h2 className="mt-0.5 text-base font-semibold text-white">Search & Place</h2>
      </div>

      {/* Tip */}
      {!pending && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <p className="text-xs text-white/55 leading-relaxed">
            Search for any plant, set its light requirement, then click to place it on the balcony.
          </p>
        </div>
      )}

      {/* Placing banner */}
      {pending && (
        <div className="rounded-xl border border-green-400/30 bg-green-500/10 p-3">
          <p className="text-xs font-semibold text-green-300">
            Placing: {pending.commonName}
          </p>
          <p className="mt-0.5 text-xs text-white/50">
            Click on the balcony to set position. Press Esc to cancel.
          </p>
          <button
            onClick={() => setPending(null)}
            className="mt-2 text-xs text-white/40 underline hover:text-white/70"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Search input */}
      <div className="relative">
        <svg
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/30"
          width="15" height="15" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search plants…"
          className="w-full rounded-xl border border-white/15 bg-white/8 py-2.5 pl-9 pr-4 text-sm text-white placeholder-white/30 outline-none transition focus:border-white/35 focus:bg-white/12"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/20 border-t-white/60" />
          </div>
        )}
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/40">
            Results
          </p>
          <div className="flex flex-col gap-2">
            {results.map((r) => {
              const key = `${r.commonName}::${r.species}`;
              return (
                <PlantCard
                  key={key}
                  result={r}
                  lightReq={getLightReq(key)}
                  onLightChange={(v) => setLightReqs((prev) => ({ ...prev, [key]: v }))}
                  onPlace={() => handlePlace(r)}
                  isPending={isPendingResult(r)}
                />
              );
            })}
          </div>
        </div>
      )}

      {query.length >= 2 && !loading && results.length === 0 && (
        <p className="text-center text-xs text-white/35 py-4">No plants found</p>
      )}

      {/* Divider */}
      {results.length > 0 && <div className="border-t border-white/10" />}

      {/* Placed plants list */}
      <PlacedList />
    </aside>
  );
}
