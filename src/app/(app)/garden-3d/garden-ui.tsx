"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useGardenStore, PLANT_CATALOG, type PlantDef } from "./garden-store";

const SEASON_ICON = { spring: "🌸", summer: "☀️", autumn: "🍂", winter: "❄️" };
const TIME_ICON = { morning: "🌅", day: "☀️", evening: "🌇" };

function PlantCard({ plant }: { plant: PlantDef }) {
  const selected = useGardenStore((s) => s.selected);
  const selectPlant = useGardenStore((s) => s.selectPlant);
  const isSelected = selected?.id === plant.id;

  return (
    <button
      onClick={() => selectPlant(isSelected ? null : plant)}
      className={`group w-full rounded-xl border p-3 text-left transition-all duration-150 ${
        isSelected
          ? "border-green-400/50 bg-green-950/60 shadow-[0_0_16px_rgba(74,222,128,0.15)]"
          : "border-white/8 bg-white/4 hover:border-white/20 hover:bg-white/8"
      }`}
    >
      <div className="flex items-center gap-2.5">
        <div
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg text-lg shadow"
          style={{ background: `linear-gradient(135deg, ${plant.foliageColor}, ${plant.foliageColor2})` }}
        >
          {plant.emoji}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white/90">{plant.name}</p>
          <p className="truncate text-[10px] italic text-white/35">{plant.species}</p>
        </div>
        {isSelected && (
          <span className="flex-shrink-0 rounded-full bg-green-400/20 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-green-300">
            ✓
          </span>
        )}
      </div>
      <div className="mt-2 flex gap-3 text-[10px] text-white/35">
        <span>💧 {plant.waterDays}d</span>
        <span>☀️ {plant.sunlight.split(" ").slice(-1)[0]}</span>
      </div>
    </button>
  );
}

function ActivePlantPanel() {
  const activeId = useGardenStore((s) => s.activeId);
  const placed = useGardenStore((s) => s.placed);
  const removePlant = useGardenStore((s) => s.removePlant);
  const setActive = useGardenStore((s) => s.setActive);

  const item = placed.find((p) => p.id === activeId);
  if (!item) return null;
  const { plant } = item;

  return (
    <div className="absolute bottom-6 left-1/2 z-30 w-[320px] -translate-x-1/2 overflow-hidden rounded-2xl border border-white/12 shadow-2xl backdrop-blur-2xl"
      style={{ background: "linear-gradient(135deg, rgba(10,30,15,0.92), rgba(15,40,20,0.88))" }}>
      <div className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl shadow-lg"
            style={{ background: `linear-gradient(135deg, ${plant.foliageColor}, ${plant.foliageColor2})` }}>
            {plant.emoji}
          </div>
          <div className="flex-1">
            <p className="text-base font-bold text-white">{plant.name}</p>
            <p className="text-xs italic text-white/40">{plant.species}</p>
          </div>
          <button onClick={() => setActive(null)} className="rounded-lg p-1.5 text-white/40 hover:text-white transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <p className="mt-2 text-xs leading-5 text-white/50">{plant.description}</p>

        <div className="mt-3 grid grid-cols-3 gap-2">
          {[
            { icon: "💧", label: "Water", val: `${plant.waterDays} days` },
            { icon: "☀️", label: "Light", val: plant.sunlight },
            { icon: "📏", label: "Type", val: plant.type },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl bg-white/6 p-2 text-center">
              <p className="text-base">{stat.icon}</p>
              <p className="mt-0.5 text-[11px] font-medium leading-tight text-white/80">{stat.val}</p>
              <p className="text-[9px] text-white/30">{stat.label}</p>
            </div>
          ))}
        </div>

        <button
          onClick={() => removePlant(item.id)}
          className="mt-3 w-full rounded-xl border border-red-500/25 bg-red-950/30 py-2 text-sm font-medium text-red-400 hover:bg-red-900/40 transition-colors"
        >
          Remove from garden
        </button>
      </div>
    </div>
  );
}

export function GardenUI() {
  const selected = useGardenStore((s) => s.selected);
  const placed = useGardenStore((s) => s.placed);
  const searchQuery = useGardenStore((s) => s.searchQuery);
  const setSearch = useGardenStore((s) => s.setSearch);
  const season = useGardenStore((s) => s.season);
  const setSeason = useGardenStore((s) => s.setSeason);
  const timeOfDay = useGardenStore((s) => s.timeOfDay);
  const setTime = useGardenStore((s) => s.setTime);

  const filtered = useMemo(
    () => searchQuery.trim()
      ? PLANT_CATALOG.filter((p) =>
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.species.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.type.includes(searchQuery.toLowerCase()),
        )
      : PLANT_CATALOG,
    [searchQuery],
  );

  return (
    <>
      {/* Top bar */}
      <div className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-3">
          <Link href="/garden"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-black/40 text-white/60 backdrop-blur hover:text-white transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
          </Link>
          <div>
            <h1 className="text-sm font-bold text-white">3D Garden Designer</h1>
            <p className="text-[10px] text-white/40">{placed.length} plant{placed.length !== 1 ? "s" : ""} placed · click to plant</p>
          </div>
        </div>

        {/* Time + Season controls */}
        <div className="flex items-center gap-2">
          {/* Time of day */}
          <div className="flex overflow-hidden rounded-full border border-white/12 bg-black/40 backdrop-blur">
            {(["morning", "day", "evening"] as const).map((t) => (
              <button key={t} onClick={() => setTime(t)}
                className={`px-3 py-1.5 text-xs transition-colors ${timeOfDay === t ? "bg-white/15 text-white" : "text-white/40 hover:text-white/70"}`}>
                {TIME_ICON[t]}
              </button>
            ))}
          </div>

          {/* Season */}
          <div className="flex overflow-hidden rounded-full border border-white/12 bg-black/40 backdrop-blur">
            {(["spring", "summer", "autumn", "winter"] as const).map((s) => (
              <button key={s} onClick={() => setSeason(s)}
                className={`px-3 py-1.5 text-xs transition-colors ${season === s ? "bg-white/15 text-white" : "text-white/40 hover:text-white/70"}`}>
                {SEASON_ICON[s]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right sidebar */}
      <div className="absolute bottom-0 right-0 top-0 z-10 flex w-[260px] flex-col border-l border-white/8 backdrop-blur-xl"
        style={{ background: "linear-gradient(180deg, rgba(8,20,12,0.92) 0%, rgba(10,25,15,0.88) 100%)" }}>
        <div className="flex flex-col h-full pt-16">
          {/* Search */}
          <div className="px-4 pb-3">
            <div className="relative">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/25">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search plants…"
                className="w-full rounded-xl border border-white/8 bg-white/6 py-2 pl-9 pr-3 text-sm text-white placeholder:text-white/25 focus:border-green-500/40 focus:outline-none"
              />
            </div>
          </div>

          {/* Selected hint */}
          <div className={`mx-4 mb-3 rounded-xl border px-3 py-2 text-[11px] transition-colors ${
            selected
              ? "border-green-500/30 bg-green-950/40 text-green-300/80"
              : "border-white/8 bg-white/4 text-white/35"
          }`}>
            {selected
              ? `🌱 Click anywhere in the garden to plant ${selected.name}`
              : "Select a plant below, then click the garden"}
          </div>

          {/* Category filter chips */}
          <div className="flex flex-wrap gap-1.5 px-4 pb-3">
            {["all", "tree", "shrub", "flower", "succulent", "herb"].map((cat) => (
              <button key={cat} onClick={() => setSearch(cat === "all" ? "" : cat)}
                className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[10px] capitalize text-white/40 hover:border-white/25 hover:text-white/70 transition-colors">
                {cat}
              </button>
            ))}
          </div>

          {/* Plant list */}
          <div className="flex-1 overflow-y-auto px-4 pb-6">
            <div className="flex flex-col gap-2">
              {filtered.map((plant) => (
                <PlantCard key={plant.id} plant={plant} />
              ))}
              {filtered.length === 0 && (
                <p className="py-10 text-center text-sm text-white/25">No plants found</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Active plant panel */}
      <ActivePlantPanel />

      {/* Intro hint */}
      {placed.length === 0 && !selected && (
        <div className="pointer-events-none absolute bottom-10 left-[calc(50%-130px)] text-center">
          <p className="text-sm text-white/40">← Pick a plant, then click the garden to place it</p>
          <p className="mt-1 text-xs text-white/25">Orbit with mouse · Scroll to zoom · Right-click drag to pan</p>
        </div>
      )}
    </>
  );
}
