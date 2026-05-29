"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useIndoorStore, INDOOR_PLANTS, type IndoorPlant, type ZoneType } from "./indoor-store";

const ZONE_LABEL: Record<ZoneType, { icon: string; color: string }> = {
  floor:      { icon: "🪴", color: "text-emerald-300" },
  shelf:      { icon: "📚", color: "text-amber-300" },
  windowsill: { icon: "🪟", color: "text-sky-300" },
  hanging:    { icon: "🪝", color: "text-violet-300" },
};

const LIGHT_LABELS = { day: "☀️ Day", evening: "🌆 Evening", golden: "🌅 Golden" };

function PlantCard({ plant }: { plant: IndoorPlant }) {
  const selected = useIndoorStore((s) => s.selected);
  const selectPlant = useIndoorStore((s) => s.selectPlant);
  const isSelected = selected?.id === plant.id;

  return (
    <button
      onClick={() => selectPlant(isSelected ? null : plant)}
      className={`w-full rounded-xl border p-3 text-left transition-all duration-150 ${
        isSelected
          ? "border-green-400/50 bg-green-950/60 shadow-[0_0_14px_rgba(74,222,128,0.15)]"
          : "border-white/8 bg-white/4 hover:border-white/18 hover:bg-white/8"
      }`}
    >
      <div className="flex items-center gap-2.5">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-lg shadow"
          style={{ background: `linear-gradient(135deg, ${plant.foliageColor}, ${plant.foliageColor2})` }}>
          {plant.emoji}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white/90">{plant.name}</p>
          <p className="truncate text-[10px] italic text-white/35">{plant.species}</p>
        </div>
        {isSelected && <span className="text-[10px] font-bold text-green-300">✓</span>}
      </div>

      {/* zone badges */}
      <div className="mt-2 flex flex-wrap gap-1">
        {plant.suitableZones.map((z) => (
          <span key={z} className={`text-[10px] ${ZONE_LABEL[z].color}`}>
            {ZONE_LABEL[z].icon} {z}
          </span>
        ))}
      </div>

      <div className="mt-1.5 flex gap-3 text-[10px] text-white/30">
        <span>💧 {plant.waterDays}d</span>
        <span>☀️ {plant.light}</span>
      </div>
    </button>
  );
}

function ActivePlantPanel() {
  const activeId = useIndoorStore((s) => s.activeId);
  const placed = useIndoorStore((s) => s.placed);
  const removePlant = useIndoorStore((s) => s.removePlant);
  const setActive = useIndoorStore((s) => s.setActive);

  const item = placed.find((p) => p.id === activeId);
  if (!item) return null;
  const { plant, zone } = item;

  return (
    <div className="absolute bottom-6 left-1/2 z-30 w-[300px] -translate-x-1/2 overflow-hidden rounded-2xl border border-white/10 shadow-2xl backdrop-blur-2xl"
      style={{ background: "linear-gradient(135deg,rgba(10,20,12,0.95),rgba(14,28,16,0.9))" }}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl"
            style={{ background: `linear-gradient(135deg,${plant.foliageColor},${plant.foliageColor2})` }}>
            {plant.emoji}
          </div>
          <div className="flex-1">
            <p className="font-bold text-white">{plant.name}</p>
            <p className="text-xs italic text-white/40">{plant.species}</p>
            <p className={`mt-0.5 text-[11px] ${ZONE_LABEL[zone.type].color}`}>
              {ZONE_LABEL[zone.type].icon} {zone.label}
            </p>
          </div>
          <button onClick={() => setActive(null)} className="text-white/30 hover:text-white transition-colors p-1">✕</button>
        </div>

        <p className="mt-2 text-xs leading-5 text-white/45">{plant.description}</p>

        <div className="mt-3 grid grid-cols-3 gap-2">
          {[
            { icon: "💧", val: `${plant.waterDays}d`, label: "Water" },
            { icon: "☀️", val: plant.light, label: "Light" },
            { icon: ZONE_LABEL[zone.type].icon, val: zone.type, label: "Zone" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl bg-white/6 p-2 text-center">
              <p>{s.icon}</p>
              <p className="text-[11px] font-medium capitalize leading-tight text-white/75">{s.val}</p>
              <p className="text-[9px] text-white/28">{s.label}</p>
            </div>
          ))}
        </div>

        <button onClick={() => removePlant(item.id)}
          className="mt-3 w-full rounded-xl border border-red-500/20 bg-red-950/30 py-1.5 text-sm text-red-400 hover:bg-red-900/40 transition-colors">
          Remove plant
        </button>
      </div>
    </div>
  );
}

export function IndoorUI() {
  const selected = useIndoorStore((s) => s.selected);
  const placed = useIndoorStore((s) => s.placed);
  const searchQuery = useIndoorStore((s) => s.searchQuery);
  const setSearch = useIndoorStore((s) => s.setSearch);
  const lightMode = useIndoorStore((s) => s.lightMode);
  const setLight = useIndoorStore((s) => s.setLight);

  const filtered = useMemo(
    () => searchQuery.trim()
      ? INDOOR_PLANTS.filter((p) =>
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.species.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.suitableZones.some((z) => z.includes(searchQuery.toLowerCase()))
        )
      : INDOOR_PLANTS,
    [searchQuery],
  );

  return (
    <>
      {/* top bar */}
      <div className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-3">
          <Link href="/garden"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-black/50 text-white/50 backdrop-blur hover:text-white transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
          </Link>
          <div>
            <h1 className="text-sm font-bold text-white">Indoor Garden</h1>
            <p className="text-[10px] text-white/40">{placed.length} plant{placed.length !== 1 ? "s" : ""} · click a glowing spot to plant</p>
          </div>
        </div>

        {/* light mode */}
        <div className="flex overflow-hidden rounded-full border border-white/12 bg-black/50 backdrop-blur">
          {(Object.keys(LIGHT_LABELS) as (keyof typeof LIGHT_LABELS)[]).map((k) => (
            <button key={k} onClick={() => setLight(k)}
              className={`px-3 py-1.5 text-xs transition-colors ${lightMode === k ? "bg-white/15 text-white" : "text-white/40 hover:text-white/70"}`}>
              {LIGHT_LABELS[k]}
            </button>
          ))}
        </div>
      </div>

      {/* sidebar */}
      <div className="absolute bottom-0 right-0 top-0 z-10 flex w-[255px] flex-col border-l border-white/8 backdrop-blur-2xl"
        style={{ background: "linear-gradient(180deg,rgba(8,16,10,0.94) 0%,rgba(10,20,12,0.9) 100%)" }}>
        <div className="flex flex-col h-full pt-16">

          {/* zone legend */}
          <div className="grid grid-cols-2 gap-1.5 px-4 pb-3">
            {(Object.entries(ZONE_LABEL) as [ZoneType, typeof ZONE_LABEL[ZoneType]][]).map(([type, info]) => (
              <div key={type} className="flex items-center gap-1.5 rounded-lg border border-white/6 bg-white/4 px-2 py-1.5">
                <span className="text-sm">{info.icon}</span>
                <span className={`text-[10px] capitalize font-medium ${info.color}`}>{type}</span>
              </div>
            ))}
          </div>

          {/* search */}
          <div className="px-4 pb-3">
            <div className="relative">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/25">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
              <input type="text" value={searchQuery} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search plants…"
                className="w-full rounded-xl border border-white/8 bg-white/6 py-2 pl-9 pr-3 text-sm text-white placeholder:text-white/25 focus:border-green-500/40 focus:outline-none" />
            </div>
          </div>

          {/* instruction */}
          <div className={`mx-4 mb-3 rounded-xl border px-3 py-2 text-[11px] transition-all ${
            selected
              ? "border-green-500/30 bg-green-950/40 text-green-300/80"
              : "border-white/8 bg-white/4 text-white/35"
          }`}>
            {selected
              ? `${selected.emoji} Click a glowing zone to place ${selected.name}`
              : "Select a plant, then click a highlighted spot in the room"}
          </div>

          {/* plant list */}
          <div className="flex-1 overflow-y-auto px-4 pb-6">
            <div className="flex flex-col gap-2">
              {filtered.map((plant) => <PlantCard key={plant.id} plant={plant} />)}
              {filtered.length === 0 && <p className="py-10 text-center text-sm text-white/25">No plants found</p>}
            </div>
          </div>
        </div>
      </div>

      {/* active plant panel */}
      <ActivePlantPanel />

      {/* first-time hint */}
      {placed.length === 0 && !selected && (
        <div className="pointer-events-none absolute bottom-10 left-[calc(50%-130px)] text-center">
          <p className="text-sm text-white/35">← Pick a plant from the panel to start</p>
          <p className="mt-1 text-xs text-white/20">Drag to orbit · Scroll to zoom · Right-drag to pan</p>
        </div>
      )}
    </>
  );
}
