"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Plant } from "@/lib/garden";

// ─── Types ────────────────────────────────────────────────────────────────────

type PlantSuggestion = {
  commonName: string;
  species: string;
  imageUrl?: string;
  family?: string;
};

type DetectionCandidate = {
  commonName: string;
  scientificName: string;
  confidence: number;
  displayName: string;
};

function PlantImageThumbnail({ plantId, fallbackUrl, alt }: { plantId: string; fallbackUrl?: string; alt: string }) {
  const [storedPhotoUrl, setStoredPhotoUrl] = useState<string | null>(null);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(`/api/plants/photo?plantId=${encodeURIComponent(plantId)}`, { method: "HEAD" })
      .then((response) => {
        if (active && response.ok) setStoredPhotoUrl(`/api/plants/photo?plantId=${encodeURIComponent(plantId)}`);
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [plantId]);

  const src = storedPhotoUrl ?? fallbackUrl;
  if (!src || imageFailed) {
    return (
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[var(--color-line)] bg-white/[.04] text-xs font-semibold text-[var(--color-muted)]">
        {alt.slice(0, 2).toUpperCase()}
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={112}
      height={112}
      unoptimized
      onError={() => setImageFailed(true)}
      className="h-14 w-14 shrink-0 rounded-2xl object-cover ring-1 ring-[var(--color-line)]"
    />
  );
}

type QuickKnowledge = {
  wateringDaysMin: number | null;
  wateringDaysMax: number | null;
  wateringBaseline: string | null;
  sunlightPreference: string | null;
  soilPreference: string | null;
  toxicity: string | null;
  companionPlants: string[];
  pestList: string[];
  careNotes: string[];
  confidence?: string;
  sources?: string[];
};

type AddPlantWorkflowProps = {
  initialPlants: Plant[];
  defaultPlacement: string;
  refreshOnChange?: boolean;
};

let didPrewarmAddPlantRoutes = false;

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function readJsonSafe<T>(response: Response): Promise<T | null> {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text) as T; } catch { return null; }
}

const SOIL_OPTIONS = [
  { value: "",             icon: "🤷", description: "I'll skip this — system will pick based on placement." },
  { value: "Potting Mix",  icon: "🪴", description: "Light mix for containers. Good drainage and root airflow." },
  { value: "Loamy",        icon: "🌱", description: "Balanced soil for most edible and ornamental garden plants." },
  { value: "Sandy",        icon: "🏜️", description: "Fast-draining. Dries quickly, needs more frequent watering." },
  { value: "Clay",         icon: "🧱", description: "Dense, holds moisture longer but drains slowly." },
  { value: "Peat mix",     icon: "🍂", description: "Moisture-retentive mix for humidity-loving indoor plants." },
] as const;

const SUNLIGHT_INFO = [
  { value: "Low light",       sun: "🌑", bars: 1, label: "Low light",       desc: "Shaded spots, away from windows. North-facing rooms." },
  { value: "Bright indirect", sun: "🌤",  bars: 2, label: "Bright indirect", desc: "Near a window but no direct rays. Most common indoors." },
  { value: "Partial sun",     sun: "⛅", bars: 3, label: "Partial sun",     desc: "3–6 hrs of direct sun daily. Morning sun, afternoon shade." },
  { value: "Full sun",        sun: "☀️",  bars: 4, label: "Full sun",        desc: "6+ hrs of direct sun daily. South/west-facing outdoors." },
] as const;

// Canonical placement values only
const PLACEMENT_OPTIONS = ["Indoor", "Balcony", "Backyard", "Terrace"] as const;

function getSoilDefault(placement: string) {
  if (placement === "Indoor" || placement === "Balcony" || placement === "Terrace") return "Potting Mix";
  return "Loamy";
}

function normalizePlacement(value: string) {
  const v = value.toLowerCase();
  if (v.includes("indoor")) return "Indoor";
  if (v.includes("balcony")) return "Balcony";
  if (v.includes("backyard")) return "Backyard";
  if (v.includes("terrace") || v.includes("rooftop")) return "Terrace";
  if (v.includes("patio")) return "Balcony";
  return "Indoor";
}

function parseWateringDays(text: string | null) {
  if (!text) return null;
  const cleaned = text.toLowerCase();
  const rangeMatch = cleaned.match(/every\s+(\d{1,2})\s*(?:-|–|to)\s*(\d{1,2})\s*(day|days|week|weeks)/i);
  if (rangeMatch) {
    const min = Number.parseInt(rangeMatch[1], 10);
    const max = Number.parseInt(rangeMatch[2], 10);
    const unit = rangeMatch[3].toLowerCase();
    if (Number.isFinite(min) && Number.isFinite(max)) {
      const scale = unit.startsWith("week") ? 7 : 1;
      return {
        min: Math.min(min, max) * scale,
        max: Math.max(min, max) * scale,
      };
    }
  }

  const dayMatch = cleaned.match(/every\s+(\d{1,2})\s*(day|days|week|weeks)/i);
  if (dayMatch) {
    const value = Number.parseInt(dayMatch[1], 10);
    const unit = dayMatch[2].toLowerCase();
    if (Number.isFinite(value)) {
      const days = unit.startsWith("week") ? value * 7 : value;
      return { min: days, max: days };
    }
  }

  if (cleaned.includes("daily")) return { min: 1, max: 1 };
  if (cleaned.includes("weekly")) return { min: 7, max: 7 };
  return null;
}

function getKnowledgeWateringRange(knowledge: QuickKnowledge | null) {
  if (!knowledge) return null;
  const fromNumbers =
    knowledge.wateringDaysMin !== null && knowledge.wateringDaysMax !== null
      ? { min: Math.min(knowledge.wateringDaysMin, knowledge.wateringDaysMax), max: Math.max(knowledge.wateringDaysMin, knowledge.wateringDaysMax) }
      : null;
  if (fromNumbers && Number.isFinite(fromNumbers.min) && Number.isFinite(fromNumbers.max) && fromNumbers.min >= 1 && fromNumbers.max <= 3650) {
    return fromNumbers;
  }
  const parsed = parseWateringDays(knowledge.wateringBaseline);
  if (!parsed || parsed.min < 1 || parsed.max > 3650) return null;
  return parsed;
}

function getSunlightWateringAdjustment(sunlight: string) {
  if (sunlight === "Low light") return 2;
  if (sunlight === "Bright indirect") return 0;
  if (sunlight === "Partial sun") return -1;
  if (sunlight === "Full sun") return -2;
  return 0;
}

function getSoilWateringAdjustment(soil: string) {
  if (soil === "Clay") return 2;
  if (soil === "Loamy") return 1;
  if (soil === "Sandy") return -1;
  if (soil === "Peat mix") return 0;
  if (soil === "Potting Mix") return 0;
  return 0;
}

function getSuggestedWateringDays(placement: string, sunlight: string, soil: string, knowledge: QuickKnowledge | null) {
  const range = getKnowledgeWateringRange(knowledge);
  if (range) {
    // Keep a documented species interval intact. Context is stored separately
    // for downstream care planning instead of inventing evidence-free offsets.
    return Math.max(1, Math.round((range.min + range.max) / 2));
  }

  const normalizedPlacement = normalizePlacement(placement);
  let base = 5;
  if (normalizedPlacement === "Indoor") base = 6;
  if (normalizedPlacement === "Balcony") base = 4;
  if (normalizedPlacement === "Backyard") base = 4;
  if (normalizedPlacement === "Terrace") base = 3;

  const adjusted = base
    + getSunlightWateringAdjustment(sunlight)
    + getSoilWateringAdjustment(soil);

  return Math.min(14, Math.max(1, adjusted));
}

function mapKnowledgeSoil(pref: string | null): string | null {
  if (!pref) return null;
  const p = pref.toLowerCase();
  if (p.includes("cactus") || p.includes("succulent") || p.includes("well draining") || p.includes("well_draining") || p.includes("fast draining")) return "Sandy";
  if (p.includes("peat")) return "Peat mix";
  if (p.includes("loam")) return "Loamy";
  if (p.includes("clay")) return "Clay";
  if (p.includes("potting")) return "Potting Mix";
  if (p.includes("rich") || p.includes("organic") || p.includes("container")) return "Potting Mix";
  return null;
}

function parseNotes(notes: string) {
  const entries = notes
    .split(";")
    .map((e) => e.trim())
    .filter(Boolean)
    .map((e) => { const [k, ...rest] = e.split("="); return [k?.trim().toLowerCase(), rest.join("=").trim()] as const; })
    .filter(([k]) => Boolean(k));
  return new Map(entries as Array<[string, string]>);
}

function readImageUrl(notes: string) {
  const value = parseNotes(notes).get("image_url");
  if (!value) return undefined;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function SunlightInfoPopup() {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        onMouseEnter={() => setOpen(true)}
        onClick={() => setOpen((v) => !v)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-white/35 bg-white/10 text-[10px] font-semibold text-white/85 hover:border-white/60 hover:bg-white/20 hover:text-white"
        aria-label="Sunlight guide"
      >
        ?
      </button>
      {open && (
        <div className="absolute left-0 top-7 z-[60] w-[min(18rem,calc(100vw-2rem))] rounded-2xl border border-white/20 bg-[#171719] p-3 text-white shadow-[0_18px_45px_rgba(0,0,0,0.55)]">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-white/70">Sunlight guide</p>
          <div className="grid gap-2">
            {SUNLIGHT_INFO.map((s) => (
              <div key={s.value} className="flex items-start gap-2">
                <span className="mt-0.5 text-base leading-none">{s.sun}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-white">{s.label}</span>
                    <div className="flex gap-0.5">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <span
                          key={i}
                          className={`inline-block h-1.5 w-4 rounded-full ${i < s.bars ? "bg-white" : "bg-white/20"}`}
                        />
                      ))}
                    </div>
                  </div>
                  <p className="text-[10px] leading-4 text-white/60">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </span>
  );
}

function mapKnowledgeSunlight(pref: string | null): string | null {
  if (!pref) return null;
  const p = pref.toLowerCase();
  if (p.includes("full")) return "Full sun";
  if (p.includes("partial") || p.includes("part")) return "Partial sun";
  if (p.includes("indirect") || p.includes("bright")) return "Bright indirect";
  if (p.includes("low") || p.includes("shade")) return "Low light";
  return null;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AddPlantWorkflow({ initialPlants, defaultPlacement, refreshOnChange = false }: AddPlantWorkflowProps) {
  const router = useRouter();
  const [tab, setTab] = useState<"search" | "upload">("search");
  const [plants, setPlants] = useState(initialPlants);
  const [editingPlantId, setEditingPlantId] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PlantSuggestion[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [selectedPlant, setSelectedPlant] = useState<{ commonName: string; species: string; source: "search" | "image"; imageUrl?: string } | null>(null);
  const [selectedKnowledge, setSelectedKnowledge] = useState<QuickKnowledge | null>(null);
  const [selectedKnowledgeLoading, setSelectedKnowledgeLoading] = useState(false);

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [detectionCandidates, setDetectionCandidates] = useState<DetectionCandidate[]>([]);
  const [detecting, setDetecting] = useState(false);
  const [detectError, setDetectError] = useState<string | null>(null);
  const [detectionDone, setDetectionDone] = useState(false);

  const [nickname, setNickname] = useState("");
  const [placement, setPlacement] = useState(defaultPlacement || "Indoor");
  const [sunlight, setSunlight] = useState("Bright indirect");
  const [soilType, setSoilType] = useState(getSoilDefault(defaultPlacement || "Indoor"));
  const [wateringMode, setWateringMode] = useState<"auto" | "custom">("auto");
  const [customDays, setCustomDays] = useState("5");
  const [submitting, setSubmitting] = useState(false);
  const [removingPlantId, setRemovingPlantId] = useState<string | null>(null);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [plantPreviewUrl, setPlantPreviewUrl] = useState<string | null>(null);
  const [hoveredSuggestion, setHoveredSuggestion] = useState<PlantSuggestion | null>(null);
  const [debouncedQuery, setDebouncedQuery] = useState("");

  const formRef = useRef<HTMLDivElement>(null);
  const knowledgeRequestIdRef = useRef(0);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development" || didPrewarmAddPlantRoutes) {
      return;
    }

    didPrewarmAddPlantRoutes = true;

    const controller = new AbortController();
    const run = () => {
      void fetch("/api/plants", {
        cache: "no-store",
        credentials: "same-origin",
        signal: controller.signal,
      }).catch(() => undefined);
      void fetch("/api/plants/search?q=aloe", {
        cache: "no-store",
        credentials: "same-origin",
        signal: controller.signal,
      }).catch(() => undefined);
      void fetch("/api/knowledge?species=Ficus%20lyrata", {
        cache: "no-store",
        credentials: "same-origin",
        signal: controller.signal,
      }).catch(() => undefined);
    };

    const prewarmHandle = window.setTimeout(run, 250);

    return () => {
      controller.abort();
      window.clearTimeout(prewarmHandle);
    };
  }, []);

  useEffect(() => {
    if (!photoFile) {
      setPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(photoFile);
    setPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [photoFile]);

  useEffect(() => {
    setPlacement(defaultPlacement || "Indoor");
    setSoilType(getSoilDefault(defaultPlacement || "Indoor"));
  }, [defaultPlacement]);

  // Reset nickname when plant changes
  useEffect(() => {
    setNickname(selectedPlant?.commonName ?? "");
  }, [selectedPlant]);

  // Fetch plant knowledge once per selected species. Context changes are handled below.
  useEffect(() => {
    const species = selectedPlant?.species?.trim();

    if (!species) {
      knowledgeRequestIdRef.current += 1;
      setSelectedKnowledge(null);
      setSelectedKnowledgeLoading(false);
      return;
    }

    const requestId = knowledgeRequestIdRef.current + 1;
    knowledgeRequestIdRef.current = requestId;
    setSelectedKnowledge(null);
    setSelectedKnowledgeLoading(true);

    fetch(`/api/knowledge?species=${encodeURIComponent(species)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { found: boolean; knowledge?: QuickKnowledge } | null) => {
        if (knowledgeRequestIdRef.current !== requestId) return;
        if (d?.found && d.knowledge) {
          setSelectedKnowledge(d.knowledge);
          const suggested = mapKnowledgeSunlight(d.knowledge.sunlightPreference ?? null);
          if (suggested) setSunlight(suggested);
          const suggestedSoil = mapKnowledgeSoil(d.knowledge.soilPreference ?? null);
          if (suggestedSoil) setSoilType(suggestedSoil);
        } else {
          setSelectedKnowledge(null);
        }
        setSelectedKnowledgeLoading(false);
      })
      .catch(() => {
        if (knowledgeRequestIdRef.current !== requestId) return;
        setSelectedKnowledge(null);
        setSelectedKnowledgeLoading(false);
      });
  }, [selectedPlant?.species]);

  useEffect(() => {
    if (wateringMode !== "auto") return;
    setCustomDays(String(getSuggestedWateringDays(placement, sunlight, soilType, selectedKnowledge)));
  }, [placement, sunlight, soilType, selectedKnowledge, wateringMode]);

  // Plant search
  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
    }, 250);
    return () => window.clearTimeout(handle);
  }, [searchQuery]);

  useEffect(() => {
    let cancelled = false;
    async function search() {
      const value = debouncedQuery;
      if (tab !== "search" || value.length < 2) {
        setSearchLoading(false);
        setSearchError(null);
        return;
      }
      setSearchLoading(true);
      setSearchError(null);
      try {
        const response = await fetch(`/api/plants/search?q=${encodeURIComponent(value)}`);
        const payload = (await readJsonSafe<{ results?: PlantSuggestion[]; error?: string }>(response)) ?? {};
        if (!response.ok) throw new Error(payload.error || "Search failed");
        if (!cancelled) {
          setSearchResults(payload.results ?? []);
          setSearchLoading(false);
        }
      } catch (error) {
        if (!cancelled) {
          setSearchLoading(false);
          setSearchError(error instanceof Error ? error.message : "Search failed");
        }
      }
    }
    void search();
    return () => { cancelled = true; };
  }, [debouncedQuery, tab]);

  const canSubmit = selectedPlant !== null && !submitting;

  async function detectFromPhoto() {
    if (!photoFile) return;
    setDetecting(true); setDetectError(null);
    try {
      const formData = new FormData();
      formData.append("photo", photoFile);
      const response = await fetch("/api/plants/detect", { method: "POST", body: formData });
      const payload = (await readJsonSafe<{ candidates?: DetectionCandidate[]; error?: string }>(response)) ?? {};
      if (!response.ok) throw new Error(payload.error || "Plant detection failed");
      const candidates = payload.candidates ?? [];
      setDetectionCandidates(candidates);
      if (candidates.length === 0) setDetectError("No confident plant match found. Use manual search.");
      else setDetectionDone(true);
    } catch (error) {
      setDetectionCandidates([]);
      setDetectError(error instanceof Error ? error.message : "Plant detection failed");
    } finally {
      setDetecting(false);
    }
  }

  async function removePlant(plantId: string) {
    const plant = plants.find((entry) => entry.id === plantId);
    if (!plant || !window.confirm(`Remove ${plant.nickname} from your garden? Its open care tasks will also be removed.`)) return;

    setRemovingPlantId(plantId);
    setSubmitError(null);
    try {
      const response = await fetch(`/api/plants/${encodeURIComponent(plantId)}`, { method: "DELETE" });
      const payload = await readJsonSafe<{ error?: string }>(response);
      if (!response.ok) throw new Error(payload?.error || "Failed to remove plant");
      setPlants((prev) => prev.filter((p) => p.id !== plantId));
      if (editingPlantId === plantId) resetDraft();
      if (refreshOnChange) router.refresh();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to remove plant. Try again.");
    } finally {
      setRemovingPlantId(null);
    }
  }

  function resetDraft() {
    setSearchQuery(""); setSearchResults([]); setSelectedPlant(null); setSelectedKnowledge(null); setPlantPreviewUrl(null); setHoveredSuggestion(null);
    setSelectedKnowledgeLoading(false);
    setPhotoFile(null); setDetectionCandidates([]); setDetectionDone(false);
    setNickname(""); setPlacement(defaultPlacement || "Indoor"); setSunlight("Bright indirect");
    setSoilType(getSoilDefault(defaultPlacement || "Indoor"));
    setWateringMode("auto"); setCustomDays("5"); setEditingPlantId(null); setSubmitError(null);
  }

  async function submitPlant() {
    if (!selectedPlant) return;
    setSubmitting(true); setSubmitError(null);
    try {
      const parsedCustomDays = Number.parseInt(customDays || "5", 10);
      const wateringIntervalDays = wateringMode === "custom"
        ? Math.max(1, Number.isFinite(parsedCustomDays) ? parsedCustomDays : 5)
        : getSuggestedWateringDays(placement, sunlight, soilType, selectedKnowledge);

      const knowledgeWateringRange = getKnowledgeWateringRange(selectedKnowledge);
      const knowledgeSources = selectedKnowledge?.sources?.join(",") || "unknown";
      const knowledgeConfidence = selectedKnowledge?.confidence || "unknown";

      const response = await fetch(
        editingPlantId ? `/api/plants/${editingPlantId}` : "/api/plants",
        {
          method: editingPlantId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nickname: nickname.trim() || selectedPlant.commonName,
            species: selectedPlant.species,
            placement: normalizePlacement(placement),
            sunlight,
            wateringIntervalDays,
            notes: [
              `source=${selectedPlant.source}`,
              selectedPlant.imageUrl ? `image_url=${encodeURIComponent(selectedPlant.imageUrl)}` : "",
              `knowledge_source=${knowledgeSources}`,
              `knowledge_confidence=${knowledgeConfidence}`,
              `soil=${soilType}`,
              `soil_source=${selectedKnowledge?.soilPreference ?? "placement_default"}`,
              `sunlight=${sunlight}`,
              `sunlight_source=${selectedKnowledge?.sunlightPreference ?? "placement_default"}`,
              `watering_mode=${wateringMode}`,
              `watering_days=${wateringIntervalDays}`,
              `watering_range=${knowledgeWateringRange ? `${knowledgeWateringRange.min}-${knowledgeWateringRange.max}` : "fallback"}`,
              `custom_days=${wateringMode === "custom" ? wateringIntervalDays : ""}`,
            ].join(";"),
          }),
        },
      );

      const payload = (await readJsonSafe<{ plant?: Plant | null; error?: string }>(response)) ?? {};
      if (!response.ok) { setSubmitError(payload.error || "Failed to add plant. Try again."); return; }
      if (!payload.plant) { setSubmitError("Plant was not added. Please try again."); return; }

      let photoWarning = "";
      if (photoFile) {
        const photoForm = new FormData();
        photoForm.append("photo", photoFile);
        const photoResponse = await fetch(`/api/plants/photo?plantId=${encodeURIComponent(payload.plant.id)}`, {
          method: "POST",
          body: photoForm,
        });
        if (!photoResponse.ok) {
          photoWarning = " The plant was saved, but its photo could not be stored.";
        }
      }

      setPlants((prev) => {
        const next = prev.filter((e) => e.id !== editingPlantId);
        return [...next, payload.plant as Plant];
      });
      if (refreshOnChange) {
        router.refresh();
      }
      setSuccessMessage(`${nickname.trim() || selectedPlant.commonName} ${editingPlantId ? "updated" : "added to your garden"}!${photoWarning}`);
      setTimeout(() => setSuccessMessage(null), 3000);
      resetDraft();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Could not save the plant. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-3">
        <Tabs value={tab} onValueChange={(value) => setTab(value as "search" | "upload")}>
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="search" className="flex-1 sm:flex-none">Search plant</TabsTrigger>
            <TabsTrigger value="upload" className="flex-1 sm:flex-none">Upload photo</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <section className="grid gap-4">
          {tab === "search" ? (
            <div className="grid gap-4">
              <div className="max-w-2xl">
                <p className="text-sm font-semibold text-[var(--color-ink)]">Find a plant</p>
                <p className="mt-1 max-w-lg text-xs leading-5 text-[var(--color-muted)]">
                  Search or identify a plant, then use the settings below to save its care details.
                </p>
                <Input
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); }}
                  placeholder="Search plant name (e.g., Mango, Tulsi, Coriander)"
                  className="field-control mt-3"
                />
              </div>
              <div className="min-h-[2rem]">
                {searchLoading && <p className="text-sm text-[var(--color-muted)]">Searching plants...</p>}
                {searchError && <p className="text-sm text-[var(--color-copper)]">{searchError}</p>}
                {!searchLoading && !searchError && debouncedQuery.length >= 2 && searchResults.length === 0 && (
                  <p className="text-sm text-[var(--color-muted)]">No matching plants. Try a nearby spelling.</p>
                )}
              </div>
              {searchResults.length > 0 ? (
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px]">
                <div className="grid max-w-3xl gap-2">
                  {searchResults.map((item) => (
                    <button
                      key={`${item.commonName}-${item.species}`}
                      type="button"
                      onPointerEnter={() => setHoveredSuggestion(item)}
                      onFocus={() => setHoveredSuggestion(item)}
                      onClick={() => {
                        setSelectedPlant({ commonName: item.commonName, species: item.species, source: "search", imageUrl: item.imageUrl });
                        setPlantPreviewUrl(item.imageUrl ?? null);
                      }}
                      className={`flex items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition ${
                        selectedPlant?.species === item.species
                          ? "border-white/30 bg-white/[.09] ring-1 ring-white/20"
                          : "border-[var(--color-line)] bg-white/5 hover:border-white/20"
                      }`}
                    >
                      {item.imageUrl ? (
                        <Image src={item.imageUrl} alt={item.commonName} width={40} height={40} unoptimized className="h-10 w-10 rounded-xl object-cover ring-1 ring-[var(--color-line)]" />
                      ) : (
                        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--color-line)] bg-white/[.04] text-lg">🌿</span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-[var(--color-ink)]">{item.commonName}</span>
                        <span className="block truncate text-xs italic text-[var(--color-muted)]">{item.species}</span>
                      </span>
                      <span className="text-xs font-medium text-white/55">Select</span>
                    </button>
                  ))}
                </div>
                <aside className="hidden lg:block">
                  <div className="sticky top-4 rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-3 shadow-[0_12px_28px_rgba(0,0,0,0.08)]">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-muted)]">Image check</p>
                      <span className="rounded-full border border-[var(--color-line)] bg-[var(--color-canvas-soft)] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--color-muted)]">
                        Preview
                      </span>
                    </div>
                    <div className="mt-3 overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-canvas-soft)]">
                      {hoveredSuggestion?.imageUrl || plantPreviewUrl ? (
                        <Image
                          src={hoveredSuggestion?.imageUrl ?? plantPreviewUrl ?? ""}
                          alt={`${hoveredSuggestion?.commonName ?? selectedPlant?.commonName ?? "Plant"} reference`}
                          width={480}
                          height={480}
                          unoptimized
                          className="aspect-square h-44 w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-44 items-center justify-center px-6 text-center text-xs leading-5 text-[var(--color-muted)]">
                          Pick a result to preview the reference image here.
                        </div>
                      )}
                    </div>
                    <p className="mt-2 text-[11px] leading-5 text-[var(--color-muted)]">
                      Use this to verify the plant image before saving it.
                    </p>
                  </div>
                </aside>
              </div>
              ) : null}
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start">
              <label className="group relative flex min-h-[220px] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed border-[var(--color-line)] bg-[var(--color-canvas-soft)] text-center transition hover:border-[var(--color-canopy)]/35 hover:bg-white">
                {previewUrl ? (
                  <Image src={previewUrl} alt="Uploaded plant photo" width={440} height={440} unoptimized className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-2 px-6">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-line)] bg-white text-[var(--color-ink)] shadow-sm">
                      +
                    </span>
                    <span className="text-sm font-semibold text-[var(--color-ink)]">Choose a plant photo</span>
                    <span className="text-xs leading-5 text-[var(--color-muted)]">Tap to upload JPG, PNG, or WEBP</span>
                  </div>
                )}
                <span className="absolute bottom-3 rounded-full border border-[var(--color-line)] bg-white/90 px-3 py-1.5 text-xs font-medium text-[var(--color-ink)] shadow-sm backdrop-blur-sm">
                  {previewUrl ? "Change photo" : "Choose photo"}
                </span>
                <Input
                  type="file"
                  accept="image/*"
                  aria-label="Choose plant photo"
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    if (file && !file.type.startsWith("image/")) {
                      setPhotoFile(null);
                      setDetectError("Choose an image file such as JPG, PNG, or WEBP.");
                      e.target.value = "";
                      return;
                    }
                    if (file && file.size > 4 * 1024 * 1024) {
                      setPhotoFile(null);
                      setDetectError("That image is too large. Choose a file smaller than 4 MB.");
                      e.target.value = "";
                      return;
                    }
                    setPhotoFile(file);
                    setDetectionCandidates([]);
                    setSelectedPlant(null);
                    setPlantPreviewUrl(null);
                    setHoveredSuggestion(null);
                    setDetectError(null);
                    setDetectionDone(false);
                  }}
                />
              </label>

              <div className="grid content-start gap-3 rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--color-ink)]">Identify from a photo</p>
                    <p className="mt-1 max-w-xl text-xs leading-5 text-[var(--color-muted)]">Use a clear JPG, PNG, or WEBP photo up to 4 MB. We’ll keep the best match at the top.</p>
                  </div>
                  <span className="rounded-full border border-[var(--color-line)] bg-[var(--color-canvas-soft)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-muted)]">
                    Photo
                  </span>
                </div>
                {photoFile ? (
                  <p className="inline-flex w-fit items-center rounded-full border border-[var(--color-line)] bg-[var(--color-canvas-soft)] px-2.5 py-1 text-xs text-[var(--color-muted)]">
                    Selected: {photoFile.name}
                  </p>
                ) : (
                  <p className="text-xs text-[var(--color-muted)]">No photo selected yet.</p>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" onClick={detectFromPhoto} disabled={!photoFile || detecting || detectionDone} className="w-fit">
                    {detecting ? "Identifying…" : detectionDone ? "Identification complete" : "Identify plant"}
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => setTab("search")} className="w-fit">
                    Use search
                  </Button>
                </div>
              </div>

              {detectionCandidates.length > 0 && (
                <div className="grid gap-2.5 lg:col-span-2 sm:grid-cols-2">
                  {detectionCandidates.map((candidate) => (
                    <button
                      key={`${candidate.scientificName}-${candidate.confidence}`}
                      type="button"
                      onClick={() => {
                        setSelectedPlant({ commonName: candidate.commonName, species: candidate.scientificName, source: "image" });
                        setPlantPreviewUrl(previewUrl);
                      }}
                      className={`rounded-2xl border px-3 py-3 text-left transition ${
                        selectedPlant?.species === candidate.scientificName
                          ? "border-white/30 bg-white/[.09] ring-1 ring-white/20"
                          : "border-[var(--color-line)] bg-white/5"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[var(--color-ink)]">{candidate.commonName}</p>
                          <p className="truncate text-xs italic text-[var(--color-muted)]">{candidate.scientificName}</p>
                        </div>
                        <p className="shrink-0 text-xs text-[var(--color-muted)]">{candidate.confidence}% confidence</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {detectError && <p className="text-sm text-[var(--color-copper)] lg:col-span-2">{detectError}</p>}
            </div>
          )}
      </section>

      <div ref={formRef}>
        {selectedPlant ? (
        <section className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-3 shadow-none sm:p-4">
            <div className="grid gap-4">
              <div className="flex items-start justify-between gap-3 border-b border-[var(--color-line)] pb-3">
                <div>
                  <p className="text-sm font-semibold text-[var(--color-ink)]">{selectedPlant.commonName}</p>
                  <p className="text-xs italic text-[var(--color-muted)]">{selectedPlant.species}</p>
                </div>
                {selectedKnowledgeLoading ? (
                    <span className="rounded-full border border-[var(--color-line)] bg-white/5 px-3 py-1 text-[10px] font-medium text-[var(--color-muted)]">
                    Loading knowledge...
                  </span>
                ) : null}
              </div>

              {selectedKnowledge && !selectedKnowledgeLoading ? (
                <p className="rounded-2xl border border-white/10 bg-white/[.04] px-3 py-2 text-xs leading-5 text-[var(--color-muted)]">
                  Plant baseline
                  {selectedKnowledge.wateringDaysMin && selectedKnowledge.wateringDaysMax
                    ? `, watering every ${selectedKnowledge.wateringDaysMin}–${selectedKnowledge.wateringDaysMax} days`
                    : ""}
                  {selectedKnowledge.sunlightPreference ? `, ${selectedKnowledge.sunlightPreference}` : ""}
                  {selectedKnowledge.soilPreference ? `, ${selectedKnowledge.soilPreference}` : ""}
                </p>
              ) : null}

              <div className="relative z-10 grid divide-y divide-[var(--color-line)] rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)]">
                <label className="grid gap-1.5 px-3 py-2.5">
                  <span className="field-label">Nickname <span className="font-normal text-[var(--color-muted)]">(optional)</span></span>
                  <Input
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder={selectedPlant?.commonName ?? "e.g. Kitchen Monstera"}
                    className="field-control"
                  />
                </label>

                <div className="grid gap-3 px-3 py-2.5 sm:grid-cols-2 sm:gap-4">
                  <label className="grid gap-2">
                    <span className="field-label">Placement</span>
                    <select
                      value={placement}
                      onChange={(e) => { setPlacement(e.target.value); setSoilType(getSoilDefault(e.target.value)); }}
                      className="field-control"
                    >
                      {PLACEMENT_OPTIONS.map((v) => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-2">
                    <span className="field-label flex items-center gap-1.5">
                      Sunlight <SunlightInfoPopup />
                    </span>
                    <select value={sunlight} onChange={(e) => setSunlight(e.target.value)} className="field-control">
                      {SUNLIGHT_INFO.map((s) => (
                        <option key={s.value} value={s.value}>{s.sun} {s.value}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="grid gap-1.5 px-3 py-2.5">
                  <span className="field-label">Soil type</span>
                  <select value={soilType} onChange={(e) => setSoilType(e.target.value)} className="field-control">
                    {SOIL_OPTIONS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.icon} {s.value === "" ? "Not sure — system will decide" : s.value}
                      </option>
                    ))}
                  </select>
                  {soilType !== "" && (
                    <p className="field-hint">{SOIL_OPTIONS.find((s) => s.value === soilType)?.description}</p>
                  )}
                </label>

                <div className="grid gap-2.5 px-3 py-2.5">
                  <span className="field-label">
                    Watering{" "}
                    <span title="Choose how BloomPilot sets watering frequency for this plant." className="ml-1 cursor-help text-xs text-[var(--color-muted)]">ⓘ</span>
                  </span>
                  <div className="grid gap-2">
                    {(["auto", "custom"] as const).map((mode) => (
                      <label
                        key={mode}
                        className={`choice-card cursor-pointer p-3 ${wateringMode === mode ? "border-[var(--color-moss)] ring-2 ring-[rgba(76,121,97,0.14)]" : ""}`}
                      >
                        <input
                          type="radio"
                          name="watering-mode"
                          value={mode}
                          checked={wateringMode === mode}
                          onChange={() => setWateringMode(mode)}
                          className="mt-1 h-4 w-4 border-white/25 text-white focus:ring-white/20"
                        />
                        <span className="space-y-1">
                          <span className="block text-sm font-medium text-[var(--color-ink)]">
                            {mode === "auto" ? "Auto (recommended)" : "Customize"}
                          </span>
                          <span className="block text-xs leading-5 text-[var(--color-muted)]">
                            {mode === "auto" ? "BloomPilot sets cadence from context." : "Set your own interval in days."}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                  {wateringMode === "custom" ? (
                    <label className="grid gap-2 sm:max-w-[220px]">
                      <span className="field-label">Every X days</span>
                      <Input
                        value={customDays}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === "") { setCustomDays(""); return; }
                          const n = Number.parseInt(v, 10);
                          if (Number.isFinite(n)) setCustomDays(String(Math.max(1, Math.min(60, n))));
                        }}
                        type="number"
                        min="1"
                        max="60"
                        className="field-control"
                        placeholder="e.g., 3"
                      />
                    </label>
                  ) : (
                    <p className="field-hint">
                      Uses the plant baseline when available. Otherwise, this is a starting estimate from your placement, light, and soil.
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 border-t border-[var(--color-line)] pt-4">
                <Button type="button" onClick={submitPlant} disabled={!canSubmit}>
                  {submitting ? "Saving…" : editingPlantId ? "Update plant" : "Add plant"}
                </Button>
                <Button type="button" onClick={resetDraft} variant="secondary">Reset</Button>
              </div>
              {submitError && <p className="text-sm text-[var(--color-copper)]">{submitError}</p>}
              {successMessage && <p className="text-sm font-medium text-emerald-600">{successMessage}</p>}
            </div>
        </section>
        ) : null}
      </div>

      {/* Success toast outside form */}
      <div className="min-h-[24px]">
        {successMessage && !selectedPlant ? (
          <p className="text-sm font-medium text-emerald-600">{successMessage}</p>
        ) : null}
      </div>

      {/* Plant list */}
      <div className="grid gap-2">
        <div className="flex items-center justify-between">
          <p className="font-accent text-sm font-semibold text-[var(--color-ink)]">Added plants</p>
          <p className="text-xs text-[var(--color-muted)]">{plants.length} total</p>
        </div>
      </div>
      {submitError ? <p role="alert" className="text-sm text-[var(--color-copper)]">{submitError}</p> : null}
      {plants.length === 0 && (
        <Card className="landing-subtle-card rounded-2xl px-4 py-4 text-sm text-[var(--color-muted)]">
          No plants added yet. Add your first plant to continue.
        </Card>
      )}
      <div className="grid gap-3">
        {plants.map((plant) => {
          const noteMap = parseNotes(plant.notes);
          const plantSoil = noteMap.get("soil") || "Not set";
          const providerImageUrl = readImageUrl(plant.notes);
          return (
            <Card as="article" key={plant.id} className="landing-card rounded-xl p-3 shadow-none">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-3">
                    <PlantImageThumbnail plantId={plant.id} fallbackUrl={providerImageUrl} alt={plant.nickname} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <p className="truncate text-sm font-semibold text-[var(--color-ink)]">{plant.nickname}</p>
                      </div>
                      <p className="mt-0.5 truncate text-xs italic text-[var(--color-muted)]">{plant.species}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <span className="rounded-full border border-[var(--color-line)] bg-white/65 px-2 py-0.5 text-[10px] font-medium text-[var(--color-muted)]">
                          {plant.placement}
                        </span>
                        <span className="rounded-full border border-[var(--color-line)] bg-white/65 px-2 py-0.5 text-[10px] font-medium text-[var(--color-muted)]">
                          Every {plant.wateringIntervalDays} days
                        </span>
                        <span className="rounded-full border border-[var(--color-line)] bg-white/65 px-2 py-0.5 text-[10px] font-medium text-[var(--color-muted)]">
                          Soil: {plantSoil}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
                  <a href={`/garden/${plant.id}`} className="text-xs font-semibold text-[var(--color-moss)] underline underline-offset-2 hover:text-[var(--color-ink)]">
                    View details
                  </a>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-xs"
                    onClick={() => {
                      const nm = parseNotes(plant.notes);
                      setEditingPlantId(plant.id);
                      setSelectedPlant({ commonName: plant.nickname, species: plant.species, source: "search", imageUrl: providerImageUrl });
                      setNickname(plant.nickname);
                      setPlacement(plant.placement);
                      setSunlight(plant.sunlight);
                      setSoilType(nm.get("soil") || getSoilDefault(plant.placement));
                      setWateringMode(nm.get("watering_mode") === "custom" ? "custom" : "auto");
                      setCustomDays(nm.get("custom_days") || `${plant.wateringIntervalDays}`);
                      setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
                    }}
                  >
                    Edit
                  </Button>
                    <Button
                      type="button"
                      onClick={() => removePlant(plant.id)}
                      disabled={removingPlantId === plant.id}
                      variant="outline"
                      size="sm"
                      className="h-7 rounded-md px-2 text-[10px] text-[var(--color-muted)] transition hover:border-[rgba(182,61,61,0.35)] hover:bg-[rgba(182,61,61,0.08)] hover:text-[var(--color-copper)]"
                      aria-label={`Delete ${plant.nickname}`}
                    >
                      {removingPlantId === plant.id ? "Removing…" : "Remove"}
                    </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
