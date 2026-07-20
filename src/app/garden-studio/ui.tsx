"use client";
/* Runtime provider and object-URL images cannot be safely routed through Next's fixed remote allowlist. */
/* eslint-disable @next/next/no-img-element */

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import type { PlantKnowledge } from "@/lib/plant-knowledge";
import {
  buildStudioAdvice,
  type StudioContextPlant,
} from "@/lib/studio-advisor";
import {
  useStudio, ZONE_META, getCareScore, mapSunlight, lightToSunlight,
  type LightReq, type PendingPlant, type CameraView, type GardenTypeStudio,
} from "./store";

// ── Types ────────────────────────────────────────────────────────────────────
type SearchResult = { plantId?: string; commonName: string; species: string; imageUrl?: string };
type DetectCandidate = { commonName: string; scientificName: string; confidence: number; displayName: string };
type ApiPlant = { id: string; nickname: string; species: string; imageUrl?: string; sunlight: string; wateringIntervalDays: number };
type ApiKnowledge = {
  wateringBaseline: string | null;
  wateringDaysMin: number | null;
  wateringDaysMax: number | null;
  sunlightPreference: string | null;
  soilPreference: string | null;
  temperatureMinC: number | null;
  temperatureMaxC: number | null;
  humidityMinPercent: number | null;
  humidityMaxPercent: number | null;
  phMin: number | null;
  phMax: number | null;
  pestList: string[];
  diseaseList: string[];
  toxicity: string | null;
  pruningMonths: string | null;
  nutrientRequirements: string | null;
  companionPlants: string[];
  careNotes: string[];
  sources: string[];
  confidence: string;
};
type Tab = "search" | "photo" | "garden";

function normalizeApiKnowledge(value: ApiKnowledge): PlantKnowledge {
  return {
    source: value.sources.join(", ") || "plant_knowledge_db",
    watering_baseline: value.wateringBaseline,
    watering_days_min: value.wateringDaysMin,
    watering_days_max: value.wateringDaysMax,
    sunlight_preference: value.sunlightPreference,
    soil_preference: value.soilPreference,
    temperature_range_c: value.temperatureMinC !== null && value.temperatureMaxC !== null ? `${value.temperatureMinC}-${value.temperatureMaxC}` : null,
    temperature_min_c: value.temperatureMinC,
    temperature_max_c: value.temperatureMaxC,
    humidity_preference: value.humidityMinPercent !== null && value.humidityMaxPercent !== null ? `${value.humidityMinPercent}-${value.humidityMaxPercent}%` : null,
    humidity_min_percent: value.humidityMinPercent,
    humidity_max_percent: value.humidityMaxPercent,
    ph_min: value.phMin,
    ph_max: value.phMax,
    pest_list: value.pestList,
    disease_list: value.diseaseList,
    toxicity: value.toxicity,
    pruning_months: value.pruningMonths,
    nutrient_requirements: value.nutrientRequirements,
    companion_plants: value.companionPlants,
    care_notes: value.careNotes,
    confidence: value.confidence,
  };
}

function knowledgeLightTarget(value: string | null): LightReq | null {
  const normalized = value?.toLowerCase() ?? "";
  if (normalized.includes("full sun") || (normalized.includes("direct") && !normalized.includes("indirect"))) return "full_sun";
  if (normalized.includes("bright") || normalized.includes("indirect") || normalized.includes("partial")) return "partial_shade";
  if (normalized.includes("shade") || normalized.includes("low light")) return "shade";
  return null;
}

const LIGHT_OPTS: { req: LightReq; icon: string; label: string }[] = [
  { req: "full_sun",      icon: "☀️", label: "Full sun"  },
  { req: "partial_shade", icon: "⛅", label: "Partial"   },
  { req: "shade",         icon: "🌑", label: "Shade"     },
];

const LIGHT_LABELS: Record<LightReq, string> = {
  full_sun: "Brightest edge",
  partial_shade: "Filtered light",
  shade: "Shaded area",
};

function lightLabel(value: LightReq) {
  return LIGHT_LABELS[value];
}

// ── Light + water config row (shown after selecting a plant) ──────────────────
function PlantConfig({
  plant,
  lightReq,
  waterDays,
  onLightChange,
  onWaterChange,
  onPlace,
  onCancel,
  source,
}: {
  plant: SearchResult;
  lightReq: LightReq | null;
  waterDays: number | null;
  onLightChange: (v: LightReq) => void;
  onWaterChange: (v: number) => void;
  onPlace: () => void;
  onCancel: () => void;
  source: "loading" | "species" | "manual" | "garden";
}) {
  const pending = useStudio((s) => s.pending);
  const isPlacing = pending?.species === plant.species && pending?.commonName === plant.commonName;
  const placementBand = lightReq === "full_sun"
    ? { label: "Brightest edge", tone: "text-emerald-300", desc: "Where this plant gets the most direct light." }
    : lightReq === "shade"
      ? { label: "Shaded area", tone: "text-emerald-200", desc: "Where this plant gets little direct light." }
      : lightReq === "partial_shade"
        ? { label: "Filtered light", tone: "text-emerald-300", desc: "Where this plant gets filtered or moderate light." }
        : { label: "Choose a light target", tone: "text-white/45", desc: "Choose the light this plant needs." };
  const ready = lightReq !== null && waterDays !== null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      className="overflow-hidden rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(12,20,14,0.92),rgba(5,10,7,0.88))] shadow-[0_18px_50px_rgba(0,0,0,0.28)]"
    >
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-white/8 px-3 pt-3 pb-2.5">
        <div className="h-9 w-9 shrink-0 overflow-hidden rounded-xl ring-1 ring-white/15">
          {plant.imageUrl
            ? <img src={plant.imageUrl} alt={plant.commonName} className="h-full w-full object-cover" />
            : <div className="flex h-full w-full items-center justify-center bg-emerald-950/60 text-lg">🌿</div>
          }
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-white/90">{plant.commonName}</p>
          <p className="truncate text-[10px] italic text-white/35">{plant.species}</p>
        </div>
        <button onClick={onCancel} className="shrink-0 rounded-lg p-1 text-white/25 hover:text-white/65 transition-colors">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      {/* Config */}
      <div className="flex flex-col gap-2.5 px-3 py-2.5">
        {/* Light */}
        <div>
          <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.22em] text-white/28">Light target</p>
          <div className="flex gap-1">
            {LIGHT_OPTS.map(({ req, icon, label }) => (
              <button key={req} onClick={() => onLightChange(req)}
                className={`flex-1 rounded-xl py-1.5 text-[10px] font-medium transition-all ${
                  lightReq === req
                    ? "bg-emerald-500/22 text-emerald-300 ring-1 ring-emerald-400/35"
                    : "bg-white/5 text-white/35 hover:bg-white/10 hover:text-white/70"
                }`}>
                {icon}<br />{label}
              </button>
            ))}
          </div>
        </div>

        {/* Water */}
        <div>
          <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.22em] text-white/28">Watering</p>
          <div className="flex items-center gap-2">
            <span className="text-sm">💧</span>
            <div className="relative flex-1">
              <select value={waterDays ?? ""} onChange={(e) => onWaterChange(Number(e.target.value))}
                className="w-full appearance-none rounded-xl border border-white/10 bg-[#111813] px-2.5 py-1.5 pr-8 text-[12px] text-white/80 outline-none transition-colors focus:border-emerald-500/40">
                <option value="" disabled>Choose an interval</option>
                {[
                  [2,"Every 2 days"],[3,"Every 3 days"],[5,"Every 5 days"],
                  [7,"Once a week"],[10,"Every 10 days"],[14,"Every 2 weeks"],[21,"Every 3 weeks"],
                ].map(([v, label]) => <option key={v} value={v}>{label}</option>)}
              </select>
              <svg aria-hidden="true" viewBox="0 0 12 12" className="pointer-events-none absolute right-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-white/35" fill="none">
                <path d="m2.5 4.5 3.5 3 3.5-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-white/8 bg-black/14 px-2.5 py-2">
          <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-white/28">Light target</p>
          <p className={`mt-1 text-[11px] font-semibold ${placementBand.tone}`}>{placementBand.label}</p>
          <p className="mt-0.5 text-[9px] leading-relaxed text-white/24">{placementBand.desc}</p>
        </div>

        {/* Place button */}
        <button onClick={onPlace} disabled={!ready || source === "loading"}
          className={`w-full rounded-xl py-2 text-[12px] font-semibold transition-all ${
            isPlacing
              ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/35"
              : "bg-emerald-600/80 text-white hover:bg-emerald-600 active:scale-98 disabled:cursor-not-allowed disabled:bg-white/8 disabled:text-white/30"
          }`}>
          {isPlacing ? "Click the layout to place" : source === "loading" ? "Checking plant details…" : ready ? "Place plant" : "Choose light and watering"}
        </button>
      </div>
    </motion.div>
  );
}

// ── Search result card (mirrors main app AddPlantWorkflow style) ───────────────
function SearchResultCard({
  result,
  isSelected,
  onSelect,
}: {
  result: SearchResult;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <motion.button
      layout
      onClick={onSelect}
      whileTap={{ scale: 0.98 }}
      className={`w-full rounded-[20px] border px-3 py-3 text-left transition-all ${
        isSelected
          ? "border-emerald-400/45 bg-emerald-950/38 shadow-[0_0_18px_rgba(34,197,94,0.14)]"
          : "border-white/8 bg-white/4 hover:border-white/16 hover:bg-white/7"
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-2xl ring-1 ring-white/12 shadow-[0_6px_18px_rgba(0,0,0,0.18)]">
          {result.imageUrl
            ? <img src={result.imageUrl} alt={result.commonName} className="h-full w-full object-cover" loading="lazy" />
            : <span className="flex h-full w-full items-center justify-center bg-emerald-950/50 text-xl">🌿</span>
          }
        </div>
        <span className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-white/90">{result.commonName}</p>
          <p className="truncate text-[10px] italic text-white/38">{result.species}</p>
        </span>
        {isSelected && (
          <div className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
        )}
      </div>
    </motion.button>
  );
}

// ── Detect candidate card ─────────────────────────────────────────────────────
function DetectCard({
  candidate,
  previewUrl,
  isSelected,
  onSelect,
}: {
  candidate: DetectCandidate;
  previewUrl: string | null;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <motion.button
      onClick={onSelect}
      whileTap={{ scale: 0.97 }}
      className={`w-full rounded-[20px] border p-2.5 text-left transition-all ${
        isSelected
          ? "border-emerald-400/45 bg-emerald-950/40 shadow-[0_0_18px_rgba(34,197,94,0.14)]"
          : "border-white/8 bg-white/4 hover:border-white/15 hover:bg-white/7"
      }`}
    >
      {previewUrl && (
        <div className="mb-2 overflow-hidden rounded-2xl ring-1 ring-white/10">
          <img src={previewUrl} alt={candidate.displayName} className="h-24 w-full object-cover" />
        </div>
      )}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[12px] font-semibold text-white/90">{candidate.commonName}</p>
      <p className="text-[10px] italic text-white/38">{candidate.scientificName}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.18em] ${
          candidate.confidence >= 80 ? "bg-emerald-500/12 text-emerald-300" : "bg-white/6 text-white/28"
        }`}>
          {candidate.confidence >= 80 ? "Trusted" : "Match"}
        </span>
      </div>
      <div className="mt-1.5 flex items-center gap-1.5">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-emerald-400/70 transition-all" style={{ width: `${candidate.confidence}%` }} />
        </div>
        <span className="shrink-0 text-[9px] font-medium text-emerald-300/80">{candidate.confidence}%</span>
      </div>
      {isSelected && (
        <div className="mt-1.5 flex items-center gap-1">
          <div className="h-4 w-4 flex items-center justify-center rounded-full bg-emerald-500">
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <span className="text-[9px] text-emerald-300">Selected</span>
        </div>
      )}
    </motion.button>
  );
}

// ── Placed plant row ──────────────────────────────────────────────────────────
function PlacedRow({ id, commonName, imageUrl, lightReq, waterDays }: {
  id: string; commonName: string; imageUrl?: string; lightReq: LightReq; waterDays: number;
}) {
  const activeId  = useStudio((s) => s.activeId);
  const setActive = useStudio((s) => s.setActive);
  const remove    = useStudio((s) => s.removePlant);
  const duplicate = useStudio((s) => s.duplicatePlant);
  const isActive  = activeId === id;
  const score     = getCareScore({ waterDays });
  const dotColor  = score > 0.65 ? "#b7efbf" : score > 0.38 ? "#78d58a" : "#4f8b55";

  return (
    <motion.div layout initial={{ opacity:0,y:8 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0,y:-6 }}
      onClick={() => setActive(isActive ? null : id)}
      className={`flex cursor-pointer items-center gap-2.5 rounded-[18px] px-3 py-2.5 transition-all ${
        isActive ? "bg-emerald-950/45 ring-1 ring-emerald-400/28" : "bg-white/4 hover:bg-white/7"
      }`}
    >
      <div className="h-9 w-9 shrink-0 overflow-hidden rounded-xl ring-1 ring-white/10 shadow-[0_5px_14px_rgba(0,0,0,0.18)]">
        {imageUrl
          ? <img src={imageUrl} alt={commonName} className="h-full w-full object-cover" />
          : <div className="flex h-full w-full items-center justify-center bg-emerald-950/50 text-xs">🌿</div>
        }
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-semibold text-white/84">{commonName}</p>
        <p className="text-[9px] text-white/28">{ZONE_META[lightReq].emoji} {ZONE_META[lightReq].label} · 💧{waterDays}d</p>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/6">
          <div className="h-full rounded-full bg-emerald-400/80" style={{ width: `${Math.max(18, Math.min(100, score * 100))}%` }} />
        </div>
      </div>
      {isActive ? (
        <div className="flex shrink-0 items-center gap-0.5">
          <button onClick={(e) => { e.stopPropagation(); duplicate(id); }} title="Duplicate (⌘D)"
            className="rounded-lg p-1 text-white/35 hover:bg-white/12 hover:text-white/80 transition-colors">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
          </button>
          <button onClick={(e) => { e.stopPropagation(); remove(id); }} title="Remove"
            className="rounded-lg p-1 text-red-400/50 hover:bg-red-500/15 hover:text-red-400 transition-colors">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
          </button>
        </div>
      ) : (
        <div className="h-2 w-2 shrink-0 rounded-full" style={{ background: dotColor }} />
      )}
    </motion.div>
  );
}

// ── Your saved plants ─────────────────────────────────────────────────────────
function YourPlantRow({
  plant, onSelect, isActive, onPlace,
}: {
  plant: ApiPlant; onSelect: () => void; isActive: boolean;
  onPlace: () => void;
}) {
  return (
    <div className={`flex items-center gap-2 rounded-xl px-2.5 py-2 transition-all ${
      isActive ? "bg-emerald-950/50 ring-1 ring-emerald-400/30" : "bg-white/4"
    }`}>
      <button onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-2 text-left">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-emerald-950/40 text-xs ring-1 ring-white/10">
          {plant.imageUrl
            ? <img src={plant.imageUrl} alt="" className="h-full w-full object-cover" />
            : <span aria-hidden="true">🌿</span>}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-semibold text-white/80">{plant.nickname}</p>
          <p className="truncate text-[9px] italic text-white/28">{plant.species}</p>
        </div>
        <span className="shrink-0 text-[10px] text-white/40">{ZONE_META[mapSunlight(plant.sunlight)].emoji}</span>
      </button>
      {/* One-tap place — skips config, uses sunlight + watering from saved plant */}
      <button onClick={onPlace} title="Place in studio"
        className="shrink-0 rounded-lg border border-emerald-500/22 bg-emerald-500/12 px-2 py-1 text-[9px] font-semibold text-emerald-300 transition-all hover:bg-emerald-500/24">
        Place
      </button>
    </div>
  );
}

function ToggleRow({ on, onClick, icon, label, activeClass, info }: {
  on: boolean; onClick: () => void; icon: React.ReactNode; label: string; activeClass: string; info: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <button onClick={onClick}
        className={`flex min-w-0 flex-1 items-center gap-2 rounded-xl border px-3 py-2 text-[11px] font-medium transition-all ${
          on ? activeClass : "border-white/8 bg-white/[0.035] text-white/42 hover:border-white/14 hover:text-white/72"
        }`}
      >
        {icon}<span className="flex-1 truncate text-left">{label}</span>
        <div className={`h-3.5 w-6 shrink-0 rounded-full transition-colors ${on ? "bg-current/40" : "bg-white/10"}`}>
          <div className={`mt-0.5 h-2.5 w-2.5 rounded-full bg-white shadow transition-transform ${on ? "translate-x-2.5" : "translate-x-0.5"}`} />
        </div>
      </button>
      <span className="group relative shrink-0">
        <button type="button" aria-label={`About ${label}`}
          className="flex h-6 w-6 items-center justify-center rounded-full text-white/34 transition-colors hover:bg-white/[0.06] hover:text-white/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#78d58a]/60">
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
            <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.25" />
            <path d="M8 7.1v4M8 4.65v.1" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
          </svg>
        </button>
        <span role="tooltip" className="pointer-events-none absolute right-0 top-full z-50 mt-2 w-56 rounded-lg border border-white/12 bg-[#111813] px-2.5 py-2 text-[10px] leading-4 text-white/72 opacity-0 shadow-xl transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          {info}
        </span>
      </span>
    </div>
  );
}

function GardenStats() {
  const placed      = useStudio((s) => s.placed);
  const showHeatmap = useStudio((s) => s.showHeatmap);
  const toggleHm    = useStudio((s) => s.toggleHeatmap);
  const showZones   = useStudio((s) => s.showZones);
  const toggleZones = useStudio((s) => s.toggleZones);
  const autoArrange = useStudio((s) => s.autoArrange);
  const clearLayout = useStudio((s) => s.clearLayout);
  const avg  = placed.length ? placed.reduce((a, p) => a + getCareScore(p), 0) / placed.length : 0;
  const frequent = placed.filter((p) => getCareScore(p) > 0.65).length;
  const regular = placed.filter((p) => getCareScore(p) >= 0.35 && getCareScore(p) <= 0.65).length;
  const lessOften = placed.filter((p) => getCareScore(p) < 0.35).length;

  return (
    <div className="flex flex-col gap-2">
      <ToggleRow on={showZones} onClick={toggleZones}
        icon={<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>}
        label="Light zones" info="Shows planning bands from brightest to most shaded. It is a guide, not a light meter." activeClass="border-[#78d58a]/35 bg-[#78d58a]/12 text-[#b7efbf]" />
      <ToggleRow on={showHeatmap} onClick={toggleHm}
        icon={<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 3z"/></svg>}
        label="Watering map" info="Shows which plants need more or less frequent watering. It does not set a schedule." activeClass="border-[#78d58a]/35 bg-[#78d58a]/12 text-[#b7efbf]" />

      {placed.length > 1 && (
        <button onClick={autoArrange} title="Arrange by selected light band, then configured watering interval"
          className="group flex items-center gap-2 rounded-xl border border-emerald-500/18 bg-emerald-950/24 px-3 py-2.5 text-[11px] font-medium text-emerald-100 transition-colors hover:border-emerald-400/32 hover:bg-emerald-950/38">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
          <span className="flex-1 text-left">Arrange by light and watering</span>
          <span className="text-[9px] text-emerald-300/55">Auto</span>
        </button>
      )}
      <AnimatePresence>
        {showHeatmap && (
          <motion.div initial={{ opacity:0,height:0 }} animate={{ opacity:1,height:"auto" }} exit={{ opacity:0,height:0 }}
            className="overflow-hidden rounded-xl border border-white/8 bg-white/3 p-2.5">
            <div className="mb-1 h-1.5 rounded-full bg-gradient-to-r from-sky-400 via-slate-300 to-amber-400" />
            <div className="flex justify-between text-[8px] text-white/20"><span>Less often</span><span>More often</span></div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {placed.length > 0 && (
          <motion.div initial={{ opacity:0,y:5 }} animate={{ opacity:1,y:0 }} className="rounded-2xl border border-white/8 bg-white/3 p-3 mt-1">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-white/25">Watering mix</p>
              <span className="text-[9px] text-white/28">{placed.length} plant{placed.length === 1 ? "" : "s"}</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5 mb-2">
              {[{ l: "Frequent", v: frequent, c: "text-emerald-300" }, { l: "Regular", v: regular, c: "text-emerald-200" }, { l: "Less often", v: lessOften, c: "text-emerald-400" }].map((s) => (
                <div key={s.l} className="rounded-xl bg-white/5 p-2 text-center">
                  <p className={`text-base font-bold leading-none ${s.c}`}>{s.v}</p>
                  <p className="mt-0.5 text-[8px] text-white/20">{s.l}</p>
                </div>
              ))}
            </div>
            {avg > 0 && (
              <>
                <div className="flex justify-between text-[9px] text-white/28 mb-1">
                  <span>Watering frequency</span>
                  <span className="text-emerald-300">
                    {avg > 0.6 ? "Frequent" : avg > 0.35 ? "Regular" : "Light"}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
                  <div className="h-full rounded-full bg-emerald-400 transition-all duration-500" style={{ width:`${avg*100}%` }} />
                </div>
              </>
            )}
            <button onClick={() => { if (confirm("Clear all placed plants?")) clearLayout(); }}
              className="mt-2.5 w-full rounded-lg border border-white/10 bg-white/5 py-1.5 text-[10px] text-white/40 transition-all hover:border-emerald-400/25 hover:text-emerald-200">
              Clear layout
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function normalizeSpeciesKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function PlacementAdvisorPanel() {
  const placed = useStudio((s) => s.placed);
  const gardenType = useStudio((s) => s.gardenType);
  const activeId = useStudio((s) => s.activeId);
  const setActive = useStudio((s) => s.setActive);
  const requestView = useStudio((s) => s.requestView);
  const [contextPlants, setContextPlants] = useState<StudioContextPlant[] | null>(null);
  const [knowledgeMap, setKnowledgeMap] = useState<Record<string, PlantKnowledge | null>>({});

  useEffect(() => {
    let alive = true;
    fetch("/api/context/current")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { context?: { plants?: StudioContextPlant[] } } | null) => {
        if (!alive) return;
        setContextPlants(d?.context?.plants ?? []);
      })
      .catch(() => {
        if (alive) setContextPlants([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  const speciesKeys = useMemo(
    () =>
      Array.from(
        new Set(
          placed
            .map((plant) => normalizeSpeciesKey(plant.species))
            .filter(Boolean),
        ),
      ).sort(),
    [placed],
  );
  const speciesSignature = speciesKeys.join("|");

  useEffect(() => {
    let alive = true;
    const keys = speciesSignature ? speciesSignature.split("|").filter(Boolean) : [];
    if (!keys.length) return;

    Promise.all(
      keys.map(async (species) => {
        try {
          const response = await fetch(`/api/knowledge?species=${encodeURIComponent(species)}`);
          if (!response.ok) return [species, null] as const;
          const data = await response.json() as { found?: boolean; knowledge?: ApiKnowledge };
          return [species, data.found && data.knowledge ? normalizeApiKnowledge(data.knowledge) : null] as const;
        } catch {
          return [species, null] as const;
        }
      }),
    )
      .then((entries) => {
        if (!alive) return;
        setKnowledgeMap(Object.fromEntries(entries));
      });

    return () => {
      alive = false;
    };
  }, [speciesSignature]); // rerun only when the species set changes

  const advice = useMemo(() => buildStudioAdvice({
    gardenType,
    plants: placed,
    contextPlants: contextPlants ?? [],
    knowledgeBySpecies: knowledgeMap,
  }), [gardenType, placed, contextPlants, knowledgeMap]);

  const knowledgeLoading = speciesKeys.length > 0
    && speciesKeys.some((species) => knowledgeMap[species] === undefined);
  const contextLoading = contextPlants === null;

  const activeInsight = useMemo(
    () => advice.plantInsights.find((insight) => insight.plantId === activeId) ?? advice.plantInsights[0] ?? null,
    [advice.plantInsights, activeId],
  );

  const chips = [
    { label: "Good fit", value: advice.summary.alignedPlants, tone: "text-emerald-300" },
    { label: "Needs a move", value: advice.summary.needsMove, tone: "text-white/88" },
  ];
  const recommendations = advice.suggestions
    .filter((suggestion) => suggestion.kind !== "placement" && suggestion.severity !== "good")
    .slice(0, 2);

  return (
    <div className="mt-3 rounded-[18px] border border-white/12 bg-[linear-gradient(145deg,rgba(18,25,20,0.98),rgba(8,12,10,0.98))] p-3 shadow-[0_18px_50px_rgba(0,0,0,0.26)]">
      {(contextLoading || knowledgeLoading) && (
        <div className="mb-2 flex justify-end">
          <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/10 border-t-emerald-400/70" />
        </div>
      )}

      {placed.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {chips.map((chip) => (
            <div key={chip.label} className="rounded-xl border border-white/8 bg-white/[0.035] px-2.5 py-2">
              <p className="text-[8px] uppercase tracking-[0.16em] text-white/28">{chip.label}</p>
              <p className={`mt-1 text-base font-semibold ${chip.tone}`}>{chip.value}</p>
            </div>
          ))}
        </div>
      )}

      {activeInsight && (
        <button
          type="button"
          onClick={() => {
            setActive(activeInsight.plantId);
            requestView("orbit");
          }}
          className="mt-2.5 w-full rounded-xl border border-emerald-400/20 bg-emerald-950/20 p-3 text-left transition-colors hover:border-emerald-300/35 hover:bg-emerald-950/30"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[8px] font-semibold uppercase tracking-[0.16em] text-emerald-200/60">Selected plant</p>
              <p className="mt-1 truncate text-[12px] font-semibold text-white/90">{activeInsight.plantName}</p>
              <p className="mt-1 text-[10px] leading-relaxed text-white/48">{activeInsight.summary}</p>
            </div>
            <span className="shrink-0 rounded-full bg-emerald-400/15 px-2 py-1 text-[9px] font-semibold text-emerald-200">
              {activeInsight.fitScore === 100 ? "Good fit" : activeInsight.fitScore === 60 ? "Move closer" : "Move plant"}
            </span>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/35">
              <div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${activeInsight.fitScore}%` }} />
            </div>
            <span className="text-[9px] font-medium text-white/42">{activeInsight.fitScore}%</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[9px] text-white/46">
            <span>Now: <strong className="font-medium text-white/75">{lightLabel(activeInsight.currentZone)}</strong></span>
            <span>Target: <strong className="font-medium text-emerald-200/85">{lightLabel(activeInsight.targetZone)}</strong></span>
          </div>
          {activeInsight.nearestPlantName && activeInsight.nearestDistanceMeters !== undefined && (
            <p className="mt-2 text-[9px] leading-relaxed text-white/38">
              Nearest: <strong className="font-medium text-white/68">{activeInsight.nearestPlantName}</strong> · {activeInsight.nearestDistanceMeters.toFixed(2)}m
              <span className="text-white/24"> · physical gap only</span>
            </p>
          )}
        </button>
      )}

      {advice.plantInsights.length > 1 && (
        <div className="mt-3 border-t border-white/8 pt-2.5">
          <p className="mb-1.5 text-[8px] font-semibold uppercase tracking-[0.16em] text-white/28">Other plants</p>
          <div className="space-y-1">
            {advice.plantInsights
              .filter((insight) => insight.plantId !== activeInsight?.plantId)
              .slice(0, 3)
              .map((insight) => {
                const activeMatch = activeId === insight.plantId;
                return (
                  <button
                    key={insight.plantId}
                    type="button"
                    aria-label={`View placement fit for ${insight.plantName}`}
                    onClick={() => {
                      setActive(insight.plantId);
                      requestView("orbit");
                    }}
                    className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors hover:bg-white/6 ${activeMatch ? "border-emerald-400/30 bg-emerald-950/20" : "border-white/7 bg-white/[0.02]"}`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[10px] font-medium text-white/80">{insight.plantName}</span>
                      <span className="mt-0.5 block truncate text-[9px] text-white/35">{lightLabel(insight.currentZone)} → {lightLabel(insight.targetZone)}</span>
                    </span>
                    <span className={`shrink-0 text-[9px] font-semibold ${insight.fitScore === 100 ? "text-emerald-300" : "text-white/65"}`}>
                      {insight.fitScore === 100 ? "Good fit" : "Move"}
                    </span>
                  </button>
                );
              })}
          </div>
        </div>
      )}

      {recommendations.length > 0 && (
        <div className="mt-3 border-t border-white/8 pt-2.5">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <p className="text-[8px] font-semibold uppercase tracking-[0.16em] text-white/28">Checks to review</p>
            <span className="text-[8px] text-white/22">Plant data</span>
          </div>
          <div className="space-y-1">
            {recommendations.map((recommendation) => {
              const activeMatch = recommendation.plantIds.some((id) => id === activeId);
              return (
                <button
                  key={recommendation.id}
                  type="button"
                  aria-label={`Review ${recommendation.title}`}
                  onClick={() => {
                    setActive(recommendation.plantIds[0] ?? null);
                    requestView("orbit");
                  }}
                  className={`w-full rounded-lg border px-2.5 py-2 text-left transition-colors hover:bg-emerald-950/25 ${activeMatch ? "border-emerald-400/30 bg-emerald-950/20" : "border-white/7 bg-white/[0.02]"}`}
                >
                  <p className="truncate text-[10px] font-medium text-white/82">{recommendation.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-[9px] leading-relaxed text-white/38">{recommendation.detail}</p>
                  {recommendation.evidence[0] && (
                    <p className="mt-1 truncate text-[8px] text-emerald-200/55">{recommendation.evidence[0]}</p>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {!placed.length && (
        <div className="mt-2.5 rounded-xl border border-dashed border-white/10 bg-black/15 px-3 py-3 text-center">
          <p className="text-[10px] font-medium text-white/52">Place a plant to see its fit.</p>
        </div>
      )}

      {placed.length > 0 && advice.summary.needsMove === 0 && (
        <div className="mt-2.5 rounded-xl border border-emerald-400/18 bg-emerald-950/15 px-3 py-2 text-center">
          <p className="text-[10px] font-medium text-emerald-200/80">All plants match their light targets.</p>
        </div>
      )}
    </div>
  );
}

// ── Left panel — exact same flow as AddPlantWorkflow ──────────────────────────
export function LeftPanel() {
  const [tab, setTab]       = useState<Tab>("search");
  const [query, setQuery]   = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  // Selected plant state (before config/place)
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const [lightReq, setLightReq] = useState<LightReq | null>(null);
  const [waterDays, setWaterDays] = useState<number | null>(null);
  const [configSource, setConfigSource] = useState<"loading" | "species" | "manual" | "garden">("manual");

  // Photo detection state
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [detectError, setDetectError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<DetectCandidate[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Garden tab
  const [yourPlants, setYourPlants] = useState<ApiPlant[]>([]);
  const [yourLoading, setYourLoading] = useState(false);

  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectionRequest = useRef(0);
  const pending    = useStudio((s) => s.pending);
  const setPending = useStudio((s) => s.setPending);
  const setComp    = useStudio((s) => s.setCompanionSpecies);
  const placed     = useStudio((s) => s.placed);
  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    const openPanel = () => setCollapsed(false);
    window.addEventListener("studio:open-plants", openPanel);
    return () => window.removeEventListener("studio:open-plants", openPanel);
  }, []);

  // Revoke preview URL on unmount
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  // Fetch user's saved plants on mount (not just when garden tab opens)
  // so the tab can auto-switch and the count badge is immediately correct.
  useEffect(() => {
    setYourLoading(true);
    fetch("/api/plants").then((r) => r.ok ? r.json() : null)
      .then((d: { plants?: ApiPlant[] } | null) => { if (d?.plants) setYourPlants(d.plants); })
      .catch(() => {}).finally(() => setYourLoading(false));
  }, []);

  // Search
  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return; }
    setSearching(true);
    try {
      const r = await fetch(`/api/plants/search?q=${encodeURIComponent(q)}`);
      const d = await r.json() as { results?: SearchResult[] };
      setResults(d.results ?? []);
    } catch { setResults([]); } finally { setSearching(false); }
  }, []);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => search(query.trim()), 320);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
  }, [query, search]);

  // Photo detection
  async function detectFromPhoto() {
    if (!photoFile) return;
    setDetecting(true); setDetectError(null); setCandidates([]);
    try {
      const fd = new FormData();
      fd.append("photo", photoFile);
      const r = await fetch("/api/plants/detect", { method: "POST", body: fd });
      const d = await r.json() as { candidates?: DetectCandidate[]; error?: string };
      if (!r.ok) throw new Error(d.error ?? "Detection failed");
      const c = d.candidates ?? [];
      setCandidates(c);
      if (!c.length) setDetectError("No plant match found. Try a clearer photo.");
    } catch (e) {
      setDetectError(e instanceof Error ? e.message : "Detection failed");
    } finally { setDetecting(false); }
  }

  // Select a plant (from search or detect)
  async function handleSelect(plant: SearchResult, savedConfig?: { lightReq: LightReq; waterDays: number }) {
    if (!savedConfig && selected?.species === plant.species) {
      selectionRequest.current += 1;
      setSelected(null); return;
    }
    const requestId = ++selectionRequest.current;
    setSelected(plant);
    setPending(null);
    setComp([]);
    setLightReq(savedConfig?.lightReq ?? null);
    setWaterDays(savedConfig?.waterDays ?? null);
    setConfigSource(savedConfig ? "garden" : "loading");

    // Apply only a trusted cached species record. Missing values remain unset.
    try {
      const r = await fetch(`/api/knowledge?species=${encodeURIComponent(plant.species)}`);
      if (requestId !== selectionRequest.current) return;
      if (r.ok) {
        const d = await r.json() as { found?: boolean; knowledge?: ApiKnowledge };
        if (requestId !== selectionRequest.current) return;
        if (d.found && d.knowledge && d.knowledge.confidence !== "low" && d.knowledge.sources.length > 0) {
          setComp(d.knowledge.companionPlants);
          const lightTarget = knowledgeLightTarget(d.knowledge.sunlightPreference);
          if (!savedConfig && lightTarget) setLightReq(lightTarget);
          if (!savedConfig && d.knowledge.wateringDaysMin !== null && d.knowledge.wateringDaysMax !== null) {
            setWaterDays(Math.max(1, Math.round((d.knowledge.wateringDaysMin + d.knowledge.wateringDaysMax) / 2)));
          }
          if (!savedConfig) setConfigSource("species");
        } else {
          if (!savedConfig) setConfigSource("manual");
        }
      } else {
        if (!savedConfig) setConfigSource("manual");
      }
    } catch {
      if (!savedConfig && requestId === selectionRequest.current) setConfigSource("manual");
    }
  }

  function handlePlace() {
    if (!selected || !lightReq || waterDays === null) return;
    const p: PendingPlant = { plantId: selected.plantId, commonName: selected.commonName, species: selected.species, imageUrl: selected.imageUrl, lightReq, waterDays };
    if (pending?.species === selected.species) {
      setPending(null); setComp([]);
    } else {
      setPending(p);
    }
  }

  function cancelSelected() {
    selectionRequest.current += 1;
    setSelected(null); setPending(null); setComp([]);
  }

  // Your plants handler — opens config in search tab
  async function handleYourPlant(plant: ApiPlant) {
    const sr: SearchResult = { plantId: plant.id, commonName: plant.nickname, species: plant.species, imageUrl: plant.imageUrl };
    await handleSelect(sr, { lightReq: mapSunlight(plant.sunlight), waterDays: plant.wateringIntervalDays });
    setTab("search");
  }

  // One-tap Place — places directly without going through config
  function handleYourPlantDirect(plant: ApiPlant) {
    const p: PendingPlant = {
      plantId: plant.id,
      commonName: plant.nickname,
      species:    plant.species,
      imageUrl:   plant.imageUrl,
      lightReq:   mapSunlight(plant.sunlight),
      waterDays:  plant.wateringIntervalDays,
    };
    setPending(p);
  }

  // Default to garden tab when user has saved plants (first load)
  const hasAutoSwitched = useRef(false);
  useEffect(() => {
    if (!hasAutoSwitched.current && yourPlants.length > 0) {
      hasAutoSwitched.current = true;
      setTab("garden");
    }
  }, [yourPlants]);

  const TABS = [
    { id: "search" as Tab, label: "Find plant" },
    { id: "photo"  as Tab, label: "Photo ID" },
    { id: "garden" as Tab, label: "My plants" },
  ];

  if (collapsed) {
    return (
      <motion.button
        initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
        onClick={() => setCollapsed(false)}
        className="absolute left-3 top-[68px] z-20 flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-[#07110b]/94 px-3 py-2 text-[11px] font-semibold text-emerald-100 shadow-xl backdrop-blur-xl transition-colors hover:border-emerald-400/35 hover:bg-[#0a1a10]"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/15 text-base leading-none">+</span>
        Add plants
        {placed.length > 0 && <span className="rounded-md bg-white/7 px-1.5 py-0.5 text-[9px] text-white/45">{placed.length}</span>}
      </motion.button>
    );
  }

  return (
    <div className="absolute left-3 top-[62px] bottom-4 z-20 flex w-[min(90vw,340px)] flex-col overflow-hidden rounded-2xl border border-white/10 shadow-2xl sm:left-4"
      style={{ background: "linear-gradient(180deg,rgba(4,9,6,0.97) 0%,rgba(5,11,7,0.94) 100%)", backdropFilter: "blur(28px)" }}>

      {/* Tabs */}
      <div className="flex shrink-0 items-end border-b border-white/7 px-2 pt-2.5 pb-0">
        {TABS.map(({ id, label }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`relative flex-1 px-2 py-2 text-[11px] font-semibold transition-all rounded-t-xl ${
              tab === id ? "text-white bg-white/6" : "text-white/28 hover:text-white/58"
            }`}>
            {label}
            {tab === id && <div className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-emerald-400" />}
          </button>
        ))}
        <button onClick={() => setCollapsed(true)} aria-label="Close plant panel"
          className="mb-1.5 ml-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white/35 transition hover:bg-white/8 hover:text-white/75">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
      </div>

      {/* Placing banner */}
      <AnimatePresence>
        {pending && (
          <motion.div initial={{ opacity:0,y:-8 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0,y:-8 }} transition={{ duration:0.15 }}
            className="shrink-0 mx-3 mt-2.5 rounded-xl border border-emerald-500/22 bg-emerald-950/38 px-3 py-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                <p className="text-[11px] font-semibold text-emerald-300">Placing {pending.commonName}</p>
              </div>
              <button onClick={() => { setPending(null); setComp([]); }} className="text-[9px] text-white/25 hover:text-white/60 transition-colors">ESC</button>
            </div>
            <p className="mt-0.5 text-[9px] text-white/28 pl-3.5">Click anywhere in the layout</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── SEARCH TAB ── */}
      <AnimatePresence mode="wait">
        {tab === "search" && (
          <motion.div key="search" initial={{ opacity:0,x:-6 }} animate={{ opacity:1,x:0 }} exit={{ opacity:0,x:6 }} transition={{ duration:0.14 }}
            className="flex flex-1 flex-col overflow-hidden p-3">

            {/* Config panel when a plant is selected */}
            <AnimatePresence>
              {selected && (
                <div className="mb-3 shrink-0">
                  <PlantConfig
                    plant={selected}
                    lightReq={lightReq}
                    waterDays={waterDays}
                    onLightChange={setLightReq}
                    onWaterChange={setWaterDays}
                    onPlace={handlePlace}
                    onCancel={cancelSelected}
                    source={configSource}
                  />
                </div>
              )}
            </AnimatePresence>

            {/* Search input */}
            <div className="relative mb-3 shrink-0">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/22">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                type="text" value={query} onChange={(e) => {
                  selectionRequest.current += 1;
                  setQuery(e.target.value); setSelected(null); setPending(null); setComp([]);
                }}
                placeholder="Search plant name…"
                className="w-full rounded-xl border border-white/10 bg-white/6 py-2.5 pl-9 pr-4 text-[13px] text-white placeholder-white/22 outline-none transition focus:border-emerald-500/38 focus:bg-white/8"
              />
              {searching && <div className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/10 border-t-emerald-400/75" />}
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto pr-0.5" style={{ scrollbarWidth: "none" }}>
              {results.length > 0 ? (
                <div className="flex flex-col gap-2 pb-4">
                  {results.map((r) => (
                    <SearchResultCard
                      key={`${r.commonName}::${r.species}`}
                      result={r}
                      isSelected={selected?.species === r.species}
                      onSelect={() => handleSelect(r)}
                    />
                  ))}
                </div>
              ) : query.length >= 2 && !searching ? (
                <div className="flex flex-col items-center py-12 text-center">
                  <p className="text-2xl">🌱</p>
                  <p className="mt-2 text-sm text-white/28">No plants found for &ldquo;{query}&rdquo;</p>
                  <p className="mt-1 text-[11px] text-white/18">Try a different spelling or<br/>use a photo instead</p>
                </div>
              ) : query.length === 0 ? (
                <div className="flex flex-col items-center py-10 text-center">
                  <p className="mb-3 text-3xl">🌿</p>
                  <p className="text-[13px] font-medium text-white/42">Search any plant</p>
                  <p className="mt-1.5 text-[11px] text-white/22 leading-relaxed">
                    Basil, Lavender, Monstera,<br />Tomato, Coriander…
                  </p>
                  <button onClick={() => setTab("photo")}
                    className="mt-5 rounded-xl border border-white/10 bg-white/5 px-4 py-1.5 text-[11px] text-white/42 transition-all hover:bg-white/9 hover:text-white/70">
                    Or identify by photo →
                  </button>
                </div>
              ) : null}
            </div>
          </motion.div>
        )}

        {/* ── PHOTO TAB ── */}
        {tab === "photo" && (
          <motion.div key="photo" initial={{ opacity:0,x:-6 }} animate={{ opacity:1,x:0 }} exit={{ opacity:0,x:6 }} transition={{ duration:0.14 }}
            className="flex flex-1 flex-col overflow-hidden p-3">

            <AnimatePresence>
              {selected && (
                <div className="mb-3 shrink-0">
                  <PlantConfig
                    plant={selected}
                    lightReq={lightReq}
                    waterDays={waterDays}
                    onLightChange={setLightReq}
                    onWaterChange={setWaterDays}
                    onPlace={handlePlace}
                    onCancel={cancelSelected}
                    source={configSource}
                  />
                </div>
              )}
            </AnimatePresence>

            {/* Upload area */}
            <div className="shrink-0 mb-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  setPhotoFile(file);
                  selectionRequest.current += 1;
                  setCandidates([]); setDetectError(null); setSelected(null); setPending(null); setComp([]);
                  if (previewUrl) URL.revokeObjectURL(previewUrl);
                  setPreviewUrl(file ? URL.createObjectURL(file) : null);
                  e.target.value = "";
                }}
              />

              {previewUrl ? (
                <div className="relative overflow-hidden rounded-2xl border border-white/10">
                  <img src={previewUrl} alt="Plant photo" className="h-36 w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <button
                    onClick={() => { setPhotoFile(null); setPreviewUrl(null); setCandidates([]); setDetectError(null); }}
                    className="absolute right-2 top-2 rounded-full border border-white/20 bg-black/50 p-1 text-white/60 hover:text-white transition-colors"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                  <div className="absolute bottom-2 left-3 right-3 flex gap-2">
                    <button onClick={() => fileInputRef.current?.click()}
                      className="flex-1 rounded-xl border border-white/20 bg-black/50 py-1.5 text-[11px] text-white/70 backdrop-blur transition-all hover:bg-white/10">
                      Change
                    </button>
                    <button onClick={detectFromPhoto} disabled={detecting}
                      className="flex-1 rounded-xl bg-emerald-600/85 py-1.5 text-[11px] font-semibold text-white transition-all hover:bg-emerald-600 disabled:opacity-50">
                      {detecting ? "Identifying…" : "Identify plant"}
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => fileInputRef.current?.click()}
                  className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 bg-white/3 py-8 text-white/35 transition-all hover:border-white/28 hover:bg-white/6">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  <span className="text-[12px] font-medium">Upload a photo</span>
                  <span className="text-[10px] text-white/22">Take a clear photo of the plant</span>
                </button>
              )}
            </div>

            {detectError && (
              <p className="mb-2 shrink-0 rounded-xl border border-red-500/20 bg-red-950/25 px-3 py-2 text-[11px] text-red-300">
                {detectError}
              </p>
            )}

            {/* Candidates */}
            <div className="flex-1 overflow-y-auto pr-0.5" style={{ scrollbarWidth: "none" }}>
              {candidates.length > 0 && (
                <div className="flex flex-col gap-2 pb-4">
                  <p className="text-[9px] font-semibold uppercase tracking-widest text-white/28 mb-1">Matches found</p>
                  {candidates.map((c) => (
                    <DetectCard
                      key={`${c.scientificName}-${c.confidence}`}
                      candidate={c}
                      previewUrl={previewUrl}
                      isSelected={selected?.species === c.scientificName}
                      onSelect={() => handleSelect({ commonName: c.commonName, species: c.scientificName })}
                    />
                  ))}
                </div>
              )}
              {!detecting && !candidates.length && !detectError && !photoFile && (
                <div className="flex flex-col items-center py-6 text-center">
                  <p className="text-[11px] text-white/22 leading-relaxed">
                    Upload a photo of any plant<br/>and we&apos;ll identify it for you
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ── GARDEN TAB ── */}
        {tab === "garden" && (
          <motion.div key="garden" initial={{ opacity:0,x:-6 }} animate={{ opacity:1,x:0 }} exit={{ opacity:0,x:6 }} transition={{ duration:0.14 }}
            className="flex flex-1 flex-col overflow-hidden p-3">
            <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
              {placed.length > 0 && (
                <div className="mb-3">
                  <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-widest text-white/26">In your layout</p>
                  <div className="flex flex-col gap-1">
                    <AnimatePresence>
                      {placed.map((p) => (
                        <PlacedRow key={p.id} id={p.id} commonName={p.commonName} imageUrl={p.imageUrl} lightReq={p.lightReq} waterDays={p.waterDays} />
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              )}
              {placed.length > 0 && yourPlants.length > 0 && <div className="mb-3 border-t border-white/7" />}
              {yourLoading ? (
                <div className="flex justify-center py-8">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/10 border-t-emerald-400/65" />
                </div>
              ) : yourPlants.length > 0 ? (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-[9px] font-semibold uppercase tracking-widest text-white/26">From your garden</p>
                    <span className="text-[9px] text-white/22">{yourPlants.length} plants</span>
                  </div>
                  <div className="flex flex-col gap-1 pb-4">
                    {yourPlants.map((p) => (
                      <YourPlantRow key={p.id} plant={p}
                        isActive={selected?.commonName === p.nickname && selected?.species === p.species}
                        onSelect={() => handleYourPlant(p)}
                        onPlace={() => handleYourPlantDirect(p)} />
                    ))}
                  </div>
                  <p className="mb-2 text-center text-[9px] text-white/20">
                    Tap <span className="font-semibold text-emerald-400/60">Place</span> to drop straight into the layout, or tap a name to configure first.
                  </p>
                </div>
              ) : placed.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-center">
                  <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/8 bg-emerald-950/25 text-2xl">🪴</div>
                  <p className="text-[13px] font-medium text-white/38">No plants yet</p>
                  <p className="mt-1 text-[11px] text-white/18 leading-relaxed">Search a plant or upload<br/>a photo to get started</p>
                  <button onClick={() => setTab("search")}
                    className="mt-4 rounded-xl border border-emerald-500/18 bg-emerald-950/25 px-4 py-1.5 text-[11px] text-emerald-400 transition-colors hover:bg-emerald-950/42">
                    Search plants →
                  </button>
                </div>
              ) : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Right panel ───────────────────────────────────────────────────────────────
export function RightPanel() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hidden, setHidden] = useState(false);

  if (hidden) {
    return (
      <button onClick={() => setHidden(false)} aria-label="Show placement fit" title="Show placement fit"
        className="absolute right-3 top-[68px] z-20 flex items-center gap-2 rounded-xl border border-[#78d58a]/25 bg-[#101a13]/95 px-3 py-2 text-[11px] font-semibold text-[#b7efbf] shadow-xl backdrop-blur-xl transition-colors hover:border-[#78d58a]/45 hover:bg-[#17251b]">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 19V9m6 10V5m6 14v-7m4 7H2"/></svg>
        Placement fit
      </button>
    );
  }

  return (
    <>
      {!mobileOpen && (
        <button onClick={() => setMobileOpen(true)}
          className="absolute bottom-[70px] right-3 z-20 flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-[#07110b]/94 px-3 py-2 text-[11px] font-semibold text-emerald-100 shadow-xl backdrop-blur-xl md:hidden">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19V9m6 10V5m6 14v-7m4 7H2"/></svg>
          Placement check
        </button>
      )}
      <div className={`absolute bottom-[68px] left-3 right-3 top-[62px] z-30 w-auto flex-col overflow-hidden rounded-2xl border border-white/12 shadow-2xl md:left-auto md:right-3 md:flex md:w-[310px] ${mobileOpen ? "flex" : "hidden"}`}
        style={{ background: "linear-gradient(145deg,rgba(18,25,20,0.98) 0%,rgba(7,11,9,0.98) 100%)", backdropFilter: "blur(28px)" }}>
      <div className="flex shrink-0 items-center justify-between border-b border-white/10 bg-white/[0.02] px-4 py-3">
        <div>
          <p className="text-[11px] font-semibold text-white/80">Placement fit</p>
          <p className="mt-0.5 text-[9px] text-white/30">Fit and care checks</p>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => { setHidden(true); setMobileOpen(false); }} aria-label="Hide placement fit" title="Hide placement fit"
            className="flex h-7 items-center gap-1.5 rounded-lg px-2 text-[10px] text-white/38 transition-colors hover:bg-white/[0.06] hover:text-white/78">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5m6-6-6 6 6 6"/></svg>
            <span className="hidden sm:inline">Hide</span>
          </button>
          <button onClick={() => setMobileOpen(false)} aria-label="Close placement fit"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-white/35 transition-colors hover:bg-white/[0.06] hover:text-white/75 md:hidden">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4" style={{ scrollbarWidth: "none" }}>
        <GardenStats />
        <PlacementAdvisorPanel />
        <SaveGardenBar />
      </div>
    </div>
    </>
  );
}

// ── Garden type switcher ──────────────────────────────────────────────────────
const GARDEN_TYPES: { id: GardenTypeStudio; label: string; icon: string; sub: string }[] = [
  { id: "balcony",  label: "Balcony garden",  icon: "🏠", sub: "Containers · Open edge" },
  { id: "terrace",  label: "Terrace garden",  icon: "🏙️", sub: "Open sky · Rooftop deck" },
  { id: "indoor",   label: "Indoor collection",   icon: "🪟", sub: "Room · Bright window" },
  { id: "backyard", label: "Backyard garden", icon: "🌳", sub: "Beds · Open ground" },
];

function GardenTypeSwitcher() {
  const gardenType    = useStudio((s) => s.gardenType);
  const setGardenType = useStudio((s) => s.setGardenType);
  const requestView   = useStudio((s) => s.requestView);
  const [open, setOpen] = useState(false);

  function pick(t: GardenTypeStudio) {
    if (t === gardenType) { setOpen(false); return; }
    setGardenType(t);
    requestView("orbit");
    setOpen(false);
  }

  const current = GARDEN_TYPES.find((g) => g.id === gardenType)!;

  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 backdrop-blur transition-all ${
          gardenType === "balcony"
            ? "border-[#b7efbf]/28 bg-[#b7efbf]/10 hover:border-[#b7efbf]/45 hover:bg-[#b7efbf]/15"
            : gardenType === "terrace"
              ? "border-[#d18a5b]/35 bg-[#d18a5b]/10 hover:border-[#d18a5b]/55 hover:bg-[#d18a5b]/16"
            : "border-white/12 bg-white/6 hover:border-white/22 hover:bg-white/10"
        }`}>
        <span className={`flex h-5 w-5 items-center justify-center rounded-md text-xs ${gardenType === "balcony" ? "bg-[#b7efbf]/16" : gardenType === "terrace" ? "bg-[#d18a5b]/16" : "bg-white/6"}`}>{current.icon}</span>
        <span className="hidden text-[11px] font-semibold text-white/85 sm:inline">{current.label}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          className={`text-white/40 transition-transform ${open ? "rotate-180" : ""}`}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity:0, y:-6, scale:0.97 }} animate={{ opacity:1, y:0, scale:1 }}
            exit={{ opacity:0, y:-4, scale:0.97 }} transition={{ duration: 0.12 }}
            className="absolute left-0 top-full mt-1.5 z-50 w-44 overflow-hidden rounded-2xl border border-white/10 shadow-2xl"
            style={{ background: "rgba(4,10,6,0.97)", backdropFilter: "blur(28px)" }}>
            {GARDEN_TYPES.map((g) => (
              <button key={g.id} onClick={() => pick(g.id)}
                className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-white/7 ${
                  gardenType === g.id
                    ? g.id === "balcony" ? "bg-[#b7efbf]/10" : g.id === "terrace" ? "bg-[#d18a5b]/10" : "bg-white/8"
                    : ""
                }`}>
                <span className="text-base">{g.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-semibold text-white/90">{g.label}</p>
                  <p className="text-[9px] text-white/35">{g.sub}</p>
                </div>
                {gardenType === g.id && (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={g.id === "balcony" ? "#b7efbf" : g.id === "terrace" ? "#d18a5b" : "#78d58a"} strokeWidth="3">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                )}
              </button>
            ))}
            <div className="mx-3 mb-2 mt-1 rounded-lg border border-white/8 bg-white/[0.03] px-2.5 py-1.5">
              <p className="text-[9px] leading-relaxed text-white/38">
                Layouts are saved separately.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Top bar ───────────────────────────────────────────────────────────────────
export function TopBar() {
  const placed      = useStudio((s) => s.placed);
  const pending     = useStudio((s) => s.pending);
  const activeId    = useStudio((s) => s.activeId);
  const history     = useStudio((s) => s.history);
  const undo        = useStudio((s) => s.undo);
  const syncStatus  = useStudio((s) => s.syncStatus);
  const lastSavedAt = useStudio((s) => s.lastSavedAt);
  const activePlant = placed.find((p) => p.id === activeId);

  return (
    <div className="absolute left-0 right-0 top-0 z-30 flex h-14 items-center justify-between px-4 sm:px-5"
      style={{ background: "linear-gradient(180deg,rgba(4,9,6,0.98) 0%,rgba(4,9,6,0) 100%)", fontFamily: "var(--font-sans-ui)" }}>
      <div className="flex min-w-0 items-center gap-2">
        <Link href="/dashboard" aria-label="Back to dashboard"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/4 text-white/35 backdrop-blur transition-all hover:border-white/20 hover:text-white/75">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </Link>
        <GardenTypeSwitcher />
      </div>

      <div className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 md:block">
        <AnimatePresence mode="wait">
          {pending ? (
            <motion.div key="p" initial={{ opacity:0,scale:0.95 }} animate={{ opacity:1,scale:1 }} exit={{ opacity:0,scale:0.95 }}
              className="flex items-center gap-2 rounded-full border border-emerald-500/26 bg-emerald-950/68 px-3 py-1 backdrop-blur">
              <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              <span className="text-[11px] font-medium text-emerald-300">Placing {pending.commonName}</span>
            </motion.div>
          ) : activePlant ? (
            <motion.div key="a" initial={{ opacity:0,scale:0.95 }} animate={{ opacity:1,scale:1 }} exit={{ opacity:0,scale:0.95 }}
              className="flex items-center gap-1.5 rounded-full border border-blue-400/22 bg-blue-950/52 px-3 py-1 backdrop-blur">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#93c5fd" strokeWidth="2"><path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20"/></svg>
              <span className="max-w-[180px] truncate text-[10px] font-medium text-blue-300">Selected: {activePlant.commonName}</span>
            </motion.div>
          ) : placed.length > 0 ? (
            <motion.div key="s" initial={{ opacity:0 }} animate={{ opacity:1 }}
              title={lastSavedAt ? `Last synced ${new Date(lastSavedAt).toLocaleString()}` : undefined}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 backdrop-blur ${
                syncStatus === "error" ? "border-red-400/20 bg-red-950/45 text-red-200" :
                syncStatus === "saving" || syncStatus === "loading" ? "border-amber-400/18 bg-amber-950/40 text-amber-200" :
                syncStatus === "local" ? "border-sky-400/18 bg-sky-950/40 text-sky-200" :
                "border-emerald-400/16 bg-emerald-950/35 text-emerald-200"
              }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${syncStatus === "saving" || syncStatus === "loading" ? "animate-pulse bg-amber-300" : syncStatus === "error" ? "bg-red-400" : syncStatus === "local" ? "bg-sky-300" : "bg-emerald-400"}`} />
              <span className="text-[9px]">
                {syncStatus === "loading" ? "Loading" : syncStatus === "saving" ? "Saving" : syncStatus === "error" ? "Local only" : syncStatus === "local" ? "Saved locally" : "Saved"}
              </span>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <div className="flex items-center gap-1.5">
        <AnimatePresence>
          {history.length > 0 && (
            <motion.button initial={{ opacity:0,scale:0.9 }} animate={{ opacity:1,scale:1 }} exit={{ opacity:0,scale:0.9 }}
              onClick={undo} title="Undo (⌘Z)"
              className="flex h-7 w-7 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/32 backdrop-blur transition-all hover:border-white/20 hover:text-white/72">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13"/></svg>
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── Save layout → real garden (the conversion loop) ───────────────────────────
type SaveState = "idle" | "saving" | "done" | "auth" | "error";

function SaveGardenBar() {
  const placed = useStudio((s) => s.placed);
  const drafts = placed.filter((plant) => !plant.plantId);
  const gardenType = useStudio((s) => s.gardenType);
  const linkPlacedPlant = useStudio((s) => s.linkPlacedPlant);
  const [state, setState] = useState<SaveState>("idle");
  const [progress, setProgress] = useState(0);
  const [added, setAdded] = useState(0);

  if (drafts.length === 0 && state === "idle") return null;

  async function addAll() {
    setState("saving"); setProgress(0); setAdded(0);
    let ok = 0;
    for (let i = 0; i < drafts.length; i++) {
          const p = drafts[i];
          const placementLabel = gardenType === "terrace"
            ? "Terrace garden"
            : gardenType === "indoor"
              ? "Indoor collection"
              : gardenType === "backyard"
                ? "Backyard garden"
                : "Balcony garden";
          try {
            const r = await fetch("/api/plants", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                nickname: p.commonName,
                species: p.species,
                sunlight: lightToSunlight(p.lightReq),
                wateringIntervalDays: p.waterDays,
                placement: placementLabel,
              }),
            });
        if (r.status === 401) { setState("auth"); return; }
        if (r.ok) {
          const data = await r.json() as { plant?: { id?: string } };
          if (data.plant?.id) linkPlacedPlant(p.id, data.plant.id);
          ok++;
        }
      } catch { /* skip */ }
      setProgress(Math.round(((i + 1) / drafts.length) * 100));
    }
    setAdded(ok);
    setState(ok === drafts.length ? "done" : "error");
  }

  return (
    <div className="mt-3 border-t border-white/7 pt-3">
      <AnimatePresence mode="wait">
        {state === "auth" ? (
          <motion.div key="auth" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            className="rounded-xl border border-amber-500/22 bg-amber-950/25 p-3 text-center">
            <p className="text-[11px] font-medium text-amber-200">Sign in to save your garden</p>
            <p className="mt-0.5 text-[10px] text-white/35">Your layout is kept on this device.</p>
            <div className="mt-2 flex gap-1.5">
              <Link href="/sign-in" className="flex-1 rounded-lg bg-amber-500/85 py-1.5 text-center text-[11px] font-semibold text-black/85 transition hover:bg-amber-400">Sign in</Link>
              <button onClick={() => setState("idle")} className="rounded-lg border border-white/10 px-3 py-1.5 text-[11px] text-white/40 hover:text-white/70">Later</button>
            </div>
          </motion.div>
        ) : state === "done" ? (
          <motion.div key="done" initial={{ opacity:0,scale:0.97 }} animate={{ opacity:1,scale:1 }} exit={{ opacity:0 }}
            className="rounded-xl border border-emerald-500/25 bg-emerald-950/35 p-3 text-center">
            <div className="mx-auto mb-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <p className="text-[12px] font-semibold text-emerald-200">Added {added} plant{added !== 1 ? "s" : ""} to your garden</p>
            <Link href="/garden" className="mt-2 block rounded-lg bg-emerald-600 py-1.5 text-[11px] font-semibold text-white transition hover:bg-emerald-500">
              View my garden →
            </Link>
          </motion.div>
        ) : (
          <motion.button key="cta" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            onClick={addAll} disabled={state === "saving"}
            className="relative w-full overflow-hidden rounded-xl bg-emerald-600 py-2.5 text-[12px] font-semibold text-white transition-all hover:bg-emerald-500 active:scale-[0.98] disabled:opacity-90">
            {state === "saving" && (
              <span className="absolute inset-y-0 left-0 bg-emerald-400/35 transition-all duration-200" style={{ width: `${progress}%` }} />
            )}
            <span className="relative flex items-center justify-center gap-1.5">
              {state === "saving" ? (
                <>Saving… {progress}%</>
              ) : (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5v14"/></svg>
                  Track {drafts.length} new plant{drafts.length !== 1 ? "s" : ""}
                </>
              )}
            </span>
          </motion.button>
        )}
      </AnimatePresence>
      {state === "error" && <p className="mt-1.5 text-center text-[10px] text-red-400/70">{added > 0 ? `${added} added. Retry the remaining plants.` : "Couldn’t add these plants. Please try again."}</p>}
    </div>
  );
}

// ── Bottom command bar — camera views, export, hints ─────────────────────────
const VIEWS: { id: CameraView; label: string; icon: React.ReactNode }[] = [
  { id: "orbit",  label: "Orbit",  icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 2a10 10 0 010 20" opacity="0.5"/><ellipse cx="12" cy="12" rx="10" ry="4"/></svg> },
  { id: "front",  label: "Front",  icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="6" width="16" height="12" rx="2"/><path d="M4 14h16"/></svg> },
  { id: "top",    label: "Top",    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 4v16M15 4v16"/></svg> },
  { id: "corner", label: "Corner", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 16l9-13 9 13"/><path d="M3 16l9 5 9-5"/></svg> },
];

export function BottomBar() {
  const requestView = useStudio((s) => s.requestView);
  const placed      = useStudio((s) => s.placed);
  const [active, setActive] = useState<CameraView>("orbit");

  function pick(v: CameraView) { setActive(v); requestView(v); }
  function exportImage() { window.dispatchEvent(new Event("studio:capture")); }

  return (
    <div className="pointer-events-none absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2">
      {/* Camera views */}
      <div className="pointer-events-auto flex items-center gap-1 rounded-2xl border border-white/8 bg-black/45 p-1 backdrop-blur-xl">
        {VIEWS.map((v) => (
          <button key={v.id} onClick={() => pick(v.id)} title={`${v.label} view`}
            className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[10px] font-medium transition-all ${
              active === v.id ? "bg-white/12 text-white" : "text-white/35 hover:text-white/70"
            }`}>
            {v.icon}<span className="hidden sm:inline">{v.label}</span>
          </button>
        ))}
      </div>

      {/* Export */}
      <button onClick={exportImage} disabled={placed.length === 0} title="Download as image"
        className="pointer-events-auto flex items-center gap-1.5 rounded-2xl border border-emerald-500/22 bg-emerald-950/55 px-3 py-2 text-[10px] font-semibold text-emerald-300 backdrop-blur-xl transition-all hover:bg-emerald-900/55 disabled:cursor-not-allowed disabled:opacity-35">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        <span className="hidden sm:inline">Export</span>
      </button>
    </div>
  );
}

// ── First-visit welcome overlay ───────────────────────────────────────────────
const WELCOME_KEY = "bloom-studio-welcomed";
const WELCOME_STEPS = [
  { icon: "01", title: "Add plants", body: "Search your garden or identify a plant from a photo." },
  { icon: "02", title: "Set care needs", body: "Confirm the light and watering this space provides." },
  { icon: "03", title: "Place and review", body: "Arrange plants, check the fit, and save the layout." },
];

export function WelcomeOverlay() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try { setOpen(!localStorage.getItem(WELCOME_KEY)); } catch {}
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  function dismiss() {
    try { localStorage.setItem(WELCOME_KEY, "1"); } catch {}
    setOpen(false);
    window.dispatchEvent(new Event("studio:open-plants"));
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="absolute inset-0 z-40 flex items-center justify-center p-6"
          style={{ background: "radial-gradient(ellipse at center, rgba(3,8,5,0.62) 0%, rgba(2,5,3,0.86) 100%)", backdropFilter: "blur(6px)" }}>
          <motion.div initial={{ opacity: 0, scale: 0.94, y: 14 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: "spring", stiffness: 240, damping: 24 }}
            className="w-full max-w-md overflow-hidden rounded-3xl border border-white/10 shadow-2xl"
            style={{ background: "linear-gradient(165deg,rgba(8,16,11,0.98),rgba(5,11,7,0.98))" }}>
            <div className="px-7 pt-7 pb-3 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22V12m0 0C12 7 7 3 2 3c0 5 4 9 10 9zm0 0c0-5 5-9 10-9-1 5-5 9-10 9"/></svg>
              </div>
              <h2 className="text-lg font-bold text-white">Plan your garden layout</h2>
              <p className="mt-1 text-[12px] text-white/40">Place plants by light and watering needs, then save the layout to your garden.</p>
            </div>
            <div className="grid grid-cols-1 gap-2.5 px-6 py-4 sm:grid-cols-3">
              {WELCOME_STEPS.map((s) => (
                <div key={s.title} className="rounded-2xl border border-white/7 bg-white/4 p-3">
                  <div className="mb-2 text-[10px] font-bold tracking-[0.2em] text-emerald-300/75">{s.icon}</div>
                  <p className="text-[12px] font-semibold text-white/85">{s.title}</p>
                  <p className="mt-0.5 text-[10px] leading-relaxed text-white/38">{s.body}</p>
                </div>
              ))}
            </div>
            <div className="px-6 pb-6 pt-1">
              <button onClick={dismiss}
                className="w-full rounded-2xl bg-emerald-600 py-3 text-sm font-semibold text-white transition-all hover:bg-emerald-500 active:scale-[0.98]">
                Add a plant →
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function GlobalStyles() {
  return (
    <style>{`
      .studio-ui { color-scheme: dark; }
      .studio-ui button:focus-visible,
      .studio-ui input:focus-visible,
      .studio-ui select:focus-visible { outline: 2px solid rgba(110, 220, 130, .72); outline-offset: 2px; }
      .studio-ui select { color-scheme: dark; }
      .studio-ui select option { background: #111813; color: #f3f7f3; }
      .studio-ui [class*="text-red-"],
      .studio-ui [class*="text-amber-"],
      .studio-ui [class*="text-yellow-"],
      .studio-ui [class*="text-blue-"],
      .studio-ui [class*="text-sky-"] { color: rgba(174, 230, 180, .82) !important; }
      .studio-ui [class*="bg-red-"],
      .studio-ui [class*="bg-amber-"],
      .studio-ui [class*="bg-yellow-"],
      .studio-ui [class*="bg-blue-"],
      .studio-ui [class*="bg-sky-"] { background-color: rgba(79, 139, 77, .14) !important; }
      .studio-ui [class*="border-red-"],
      .studio-ui [class*="border-amber-"],
      .studio-ui [class*="border-yellow-"],
      .studio-ui [class*="border-blue-"],
      .studio-ui [class*="border-sky-"] { border-color: rgba(104, 190, 110, .3) !important; }
      ::-webkit-scrollbar{display:none}
      @media (prefers-reduced-motion: reduce) {
        [class*="animate-"] { animation-duration:0.01ms!important; animation-iteration-count:1!important }
      }
    `}</style>
  );
}
