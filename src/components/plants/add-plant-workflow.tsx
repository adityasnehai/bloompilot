"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import type { Plant } from "@/lib/garden";

type PlantKnowledgeBadge = {
  toxicity: string | null;
  companionPlants: string[];
  pestList: string[];
};

function KnowledgeBadges({ plantId, species }: { plantId: string; species: string }) {
  const [data, setData] = useState<PlantKnowledgeBadge | null>(null);

  useEffect(() => {
    if (!species) return;
    fetch(`/api/knowledge?species=${encodeURIComponent(species)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { found: boolean; knowledge?: PlantKnowledgeBadge } | null) => {
        if (d?.found && d.knowledge) {
          setData({
            toxicity: d.knowledge.toxicity,
            companionPlants: d.knowledge.companionPlants ?? [],
            pestList: d.knowledge.pestList ?? [],
          });
        }
      })
      .catch(() => {});
  }, [species]);

  if (!data) return null;
  const showToxicity = data.toxicity && data.toxicity !== "none" && data.toxicity !== "non-toxic";
  const companions = data.companionPlants.slice(0, 3);
  const pests = data.pestList.slice(0, 3);
  if (!showToxicity && companions.length === 0 && pests.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {showToxicity && (
        <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700">
          ⚠ {data.toxicity}
        </span>
      )}
      {pests.map((pest) => (
        <span key={pest} className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] text-amber-700">
          🐛 {pest}
        </span>
      ))}
      {companions.map((c) => (
        <span key={c} className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-700">
          🌿 {c}
        </span>
      ))}
    </div>
  );
}

function PlantPhotoWidget({ plantId }: { plantId: string }) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`/api/plants/photo?plantId=${plantId}`, { method: "HEAD" })
      .then((r) => { if (r.ok) setPhotoUrl(`/api/plants/photo?plantId=${plantId}`); })
      .catch(() => {});
  }, [plantId]);

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("photo", file);
      const r = await fetch(`/api/plants/photo?plantId=${plantId}`, { method: "POST", body: fd });
      if (r.ok) setPhotoUrl(`/api/plants/photo?plantId=${plantId}&t=${Date.now()}`);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="mt-3 flex items-center gap-2">
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoUrl} alt="Plant photo" className="h-14 w-14 rounded-xl object-cover border border-[var(--color-line)]" />
      ) : (
        <div className="h-14 w-14 rounded-xl border border-dashed border-[var(--color-line)] bg-[var(--color-canvas-soft)] flex items-center justify-center text-xs text-[var(--color-muted)]">
          📷
        </div>
      )}
      <div>
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="text-xs text-[var(--color-canopy)] underline underline-offset-2 hover:no-underline disabled:opacity-60"
        >
          {uploading ? "Uploading…" : photoUrl ? "Change photo" : "Add photo"}
        </button>
        {photoUrl && (
          <button
            type="button"
            onClick={async () => {
              await fetch(`/api/plants/photo?plantId=${plantId}`, { method: "DELETE" });
              setPhotoUrl(null);
            }}
            className="ml-2 text-xs text-red-500 underline underline-offset-2 hover:no-underline"
          >
            Remove
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUpload(file);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}

type PlantSuggestion = {
  commonName: string;
  species: string;
  imageUrl?: string;
};

type DetectionCandidate = {
  commonName: string;
  scientificName: string;
  confidence: number;
  displayName: string;
};

type AddPlantWorkflowProps = {
  initialPlants: Plant[];
  defaultPlacement: string;
  refreshOnChange?: boolean;
};

async function readJsonSafe<T>(response: Response): Promise<T | null> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

const SOIL_OPTIONS = [
  {
    value: "Potting Mix",
    icon: "🪴",
    image: "/soil-types/potting-mix.svg",
    description: "Light mix for containers. Good drainage and root airflow.",
  },
  {
    value: "Loamy",
    icon: "🌱",
    image: "/soil-types/loamy.svg",
    description: "Balanced soil for most edible and ornamental garden plants.",
  },
  {
    value: "Sandy",
    icon: "🏜️",
    image: "/soil-types/sandy.svg",
    description: "Fast-draining soil. Dries quickly and needs more frequent watering.",
  },
  {
    value: "Clay",
    icon: "🧱",
    image: "/soil-types/clay.svg",
    description: "Dense soil that holds moisture longer but drains slowly.",
  },
  {
    value: "Peat mix",
    icon: "🍂",
    image: "/soil-types/peat-mix.svg",
    description: "Moisture-retentive mix for humidity-loving indoor plants.",
  },
] as const;

function getSoilDefault(placement: string) {
  if (
    placement === "Indoor collection" ||
    placement === "Balcony garden" ||
    placement === "Terrace or rooftop garden"
  ) {
    return "Potting Mix";
  }
  return "Loamy";
}

function getAutoWateringDays(placement: string, sunlight: string) {
  if (placement === "Indoor collection") {
    if (sunlight === "Low light") return 7;
    if (sunlight === "Full sun") return 4;
    return 5;
  }

  if (placement === "Terrace or rooftop garden") return 3;
  if (placement === "Balcony garden") return 4;
  if (placement === "Backyard garden") return 4;
  return 5;
}

function placementIcon(placement: string) {
  if (placement === "Indoor collection") return "🏠";
  if (placement === "Balcony garden") return "🪟";
  if (placement === "Backyard garden") return "🌳";
  if (placement === "Terrace or rooftop garden") return "🏙️";
  return "🪴";
}

function parseNotes(notes: string) {
  const entries = notes
    .split(";")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [key, ...rest] = entry.split("=");
      return [key?.trim().toLowerCase(), rest.join("=").trim()] as const;
    })
    .filter(([key]) => Boolean(key));

  return new Map(entries as Array<[string, string]>);
}

export function AddPlantWorkflow({
  initialPlants,
  defaultPlacement,
  refreshOnChange = false,
}: AddPlantWorkflowProps) {
  const [tab, setTab] = useState<"search" | "upload">("search");
  const [plants, setPlants] = useState(initialPlants);
  const [editingPlantId, setEditingPlantId] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PlantSuggestion[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [selectedPlant, setSelectedPlant] = useState<{
    commonName: string;
    species: string;
    source: "search" | "image";
  } | null>(null);

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [detectionCandidates, setDetectionCandidates] = useState<DetectionCandidate[]>([]);
  const [detecting, setDetecting] = useState(false);
  const [detectError, setDetectError] = useState<string | null>(null);

  const [placement, setPlacement] = useState(defaultPlacement);
  const [sunlight, setSunlight] = useState("Bright indirect");
  const [soilType, setSoilType] = useState(getSoilDefault(defaultPlacement));
  const [growthStage, setGrowthStage] = useState("growing");
  const [wateringMode, setWateringMode] = useState<"auto" | "custom">("auto");
  const [customDays, setCustomDays] = useState("5");
  const [submitting, setSubmitting] = useState(false);
  const deferredQuery = useDeferredValue(searchQuery);

  const previewUrl = useMemo(
    () => (photoFile ? URL.createObjectURL(photoFile) : null),
    [photoFile],
  );

  const canSubmit = selectedPlant !== null && !submitting;

  useEffect(() => {
    setPlacement(defaultPlacement);
    setSoilType(getSoilDefault(defaultPlacement));
  }, [defaultPlacement]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  useEffect(() => {
    let cancelled = false;

    async function search() {
      const value = deferredQuery.trim();

      if (tab !== "search" || value.length < 2) {
        setSearchResults([]);
        setSearchError(null);
        setSearchLoading(false);
        return;
      }

      setSearchLoading(true);
      setSearchError(null);
      setSearchResults([]);

      try {
        const response = await fetch(`/api/plants/search?q=${encodeURIComponent(value)}`);
        const payload = (await readJsonSafe<{
          results?: PlantSuggestion[];
          error?: string;
        }>(response)) ?? {};

        if (!response.ok) {
          throw new Error(payload.error || "Search failed");
        }

        if (!cancelled) {
          setSearchResults(payload.results ?? []);
          setSearchLoading(false);
        }
      } catch (error) {
        if (!cancelled) {
          setSearchResults([]);
          setSearchLoading(false);
          setSearchError(error instanceof Error ? error.message : "Search failed");
        }
      }
    }

    void search();

    return () => {
      cancelled = true;
    };
  }, [deferredQuery, tab]);

  async function detectFromPhoto() {
    if (!photoFile) {
      return;
    }

    setDetecting(true);
    setDetectError(null);
    try {
      const formData = new FormData();
      formData.append("photo", photoFile);
      const response = await fetch("/api/plants/detect", {
        method: "POST",
        body: formData,
      });
      const payload = (await readJsonSafe<{
        candidates?: DetectionCandidate[];
        error?: string;
      }>(response)) ?? {};

      if (!response.ok) {
        throw new Error(payload.error || "Plant detection failed");
      }

      const candidates = payload.candidates ?? [];
      setDetectionCandidates(candidates);
      if (candidates.length === 0) {
        setDetectError("No confident plant match found. Use manual search.");
      }
    } catch (error) {
      setDetectionCandidates([]);
      setDetectError(error instanceof Error ? error.message : "Plant detection failed");
    } finally {
      setDetecting(false);
    }
  }

  async function removePlant(plantId: string) {
    const response = await fetch(`/api/plants/${plantId}`, { method: "DELETE" });
    if (!response.ok) {
      setSubmitError("Failed to remove plant. Try again.");
      return;
    }
    setSubmitError(null);
    setPlants((previous) => previous.filter((plant) => plant.id !== plantId));
    if (refreshOnChange) {
      window.location.reload();
    }
  }

  function resetDraft() {
    setSearchQuery("");
    setSearchResults([]);
    setSelectedPlant(null);
    setPhotoFile(null);
    setDetectionCandidates([]);
    setPlacement(defaultPlacement);
    setSunlight("Bright indirect");
    setSoilType(getSoilDefault(defaultPlacement));
    setGrowthStage("growing");
    setWateringMode("auto");
    setCustomDays("5");
    setEditingPlantId(null);
    setSubmitError(null);
  }

  const selectedSoil = SOIL_OPTIONS.find((soil) => soil.value === soilType) ?? SOIL_OPTIONS[0];

  async function submitPlant() {
    if (!selectedPlant) {
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const parsedCustomDays = Number.parseInt(customDays || "5", 10);
      const wateringIntervalDays =
        wateringMode === "custom"
          ? Math.max(1, Number.isFinite(parsedCustomDays) ? parsedCustomDays : 5)
          : getAutoWateringDays(placement, sunlight);

      const response = await fetch(
        editingPlantId ? `/api/plants/${editingPlantId}` : "/api/plants",
        {
          method: editingPlantId ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            nickname: selectedPlant.commonName,
            species: selectedPlant.species,
            placement,
            sunlight,
            wateringIntervalDays,
            notes: `source=${selectedPlant.source};soil=${soilType};watering_mode=${wateringMode};custom_days=${wateringMode === "custom" ? wateringIntervalDays : ""};stage=${growthStage}`,
          }),
        },
      );

      const payload = (await readJsonSafe<{
        plant?: Plant | null;
        error?: string;
      }>(response)) ?? {};

      if (!response.ok) {
        setSubmitError(payload.error || "Failed to add plant. Try again.");
        return;
      }

      if (payload.plant) {
        setPlants((previous) => [payload.plant as Plant, ...previous.filter((entry) => entry.id !== editingPlantId)]);
      } else {
        setSubmitError("Plant was not added. Please try again.");
        return;
      }

      resetDraft();
      if (refreshOnChange) {
        window.location.reload();
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-5">
      <div className="inline-flex w-full rounded-2xl border border-[var(--color-line)] bg-white p-1.5 sm:w-auto">
        <button
          type="button"
          onClick={() => setTab("search")}
          className={`font-accent inline-flex flex-1 items-center justify-center rounded-xl px-4 py-2 text-sm font-medium sm:flex-none ${
            tab === "search"
              ? "border border-[var(--color-moss)] bg-[rgba(243,241,234,0.86)] text-[var(--color-ink)]"
              : "text-[var(--color-muted)]"
          }`}
        >
          Search plant
        </button>
        <button
          type="button"
          onClick={() => setTab("upload")}
          className={`font-accent inline-flex flex-1 items-center justify-center rounded-xl px-4 py-2 text-sm font-medium sm:flex-none ${
            tab === "upload"
              ? "border border-[var(--color-moss)] bg-[rgba(243,241,234,0.86)] text-[var(--color-ink)]"
              : "text-[var(--color-muted)]"
          }`}
        >
          Upload photo
        </button>
      </div>

      <div className="landing-card grid gap-5 rounded-[24px] p-5">
        {tab === "search" ? (
          <div className="grid gap-4">
            <div>
              <p className="field-label">Plant info</p>
              <input
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  setSelectedPlant(null);
                }}
                placeholder="Search plant name (e.g., Mango, Tulsi, Coriander)"
                className="field-control mt-2"
              />
            </div>
            {searchLoading ? (
              <p className="text-sm text-[var(--color-muted)]">Searching plants...</p>
            ) : null}
            {searchError ? (
              <p className="text-sm text-[var(--color-copper)]">{searchError}</p>
            ) : null}
            {!searchLoading &&
            !searchError &&
            deferredQuery.trim().length >= 2 &&
            searchResults.length === 0 ? (
              <p className="text-sm text-[var(--color-muted)]">
                No matching plants. Try a nearby spelling.
              </p>
            ) : null}
            <div className="grid gap-2">
              {searchResults.map((item) => (
                <button
                  key={`${item.commonName}-${item.species}`}
                  type="button"
                  onClick={() => {
                    setSelectedPlant({
                      commonName: item.commonName,
                      species: item.species,
                      source: "search",
                    });
                  }}
                  className={`rounded-2xl border px-4 py-3 text-left transition ${
                    selectedPlant?.species === item.species
                      ? "border-[var(--color-moss)] bg-[rgba(243,241,234,0.8)]"
                      : "border-[var(--color-line)] bg-white"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {item.imageUrl ? (
                      <Image
                        src={item.imageUrl}
                        alt={item.commonName}
                        width={44}
                        height={44}
                        unoptimized
                        className="h-11 w-11 rounded-xl object-cover"
                      />
                    ) : (
                      <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--color-line)] bg-[rgba(243,241,234,0.75)] text-lg">
                        🌿
                      </span>
                    )}
                    <span className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--color-ink)]">{item.commonName}</p>
                      <p className="truncate text-xs text-[var(--color-muted)]">{item.species}</p>
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid gap-4">
            <label className="grid gap-2">
              <span className="field-label">Upload photo</span>
              <input
                type="file"
                accept="image/*"
                className="field-control file:mr-4 file:rounded-2xl file:border-0 file:bg-[var(--color-canopy)] file:px-4 file:py-2 file:text-sm file:font-medium file:text-white"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  setPhotoFile(file);
                  setDetectionCandidates([]);
                  setSelectedPlant(null);
                  setDetectError(null);
                }}
              />
            </label>
            <button type="button" onClick={detectFromPhoto} className="button-primary" disabled={!photoFile || detecting}>
              {detecting ? "Detecting..." : "Detect plants"}
            </button>

            {detectionCandidates.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {detectionCandidates.map((candidate) => (
                  <button
                    key={`${candidate.scientificName}-${candidate.confidence}`}
                    type="button"
                    onClick={() =>
                      setSelectedPlant({
                        commonName: candidate.commonName,
                        species: candidate.scientificName,
                        source: "image",
                      })
                    }
                    className={`rounded-2xl border p-3 text-left transition ${
                      selectedPlant?.species === candidate.scientificName
                        ? "border-[var(--color-moss)] bg-[rgba(243,241,234,0.8)]"
                        : "border-[var(--color-line)] bg-white"
                    }`}
                  >
                    {previewUrl ? (
                      <Image
                        src={previewUrl}
                        alt={candidate.displayName}
                        width={320}
                        height={120}
                        unoptimized
                        className="h-24 w-full rounded-lg object-cover"
                      />
                    ) : null}
                    <p className="mt-2 truncate text-sm font-semibold text-[var(--color-ink)]">{candidate.commonName}</p>
                    <p className="truncate text-xs text-[var(--color-muted)]">{candidate.scientificName}</p>
                    <p className="mt-1 text-xs text-[var(--color-muted)]">{candidate.confidence}% confidence</p>
                  </button>
                ))}
              </div>
            ) : null}
            {detectError ? (
              <p className="text-sm text-[var(--color-copper)]">{detectError}</p>
            ) : null}

            <button type="button" className="button-ghost justify-start px-0" onClick={() => setTab("search")}>
              Select manually
            </button>
          </div>
        )}

        {selectedPlant ? (
          <div className="rounded-2xl border border-[var(--color-line)] bg-[rgba(243,241,234,0.7)] p-4">
            <p className="text-sm font-semibold text-[var(--color-ink)]">
              Selected: {selectedPlant.commonName} ({selectedPlant.species})
            </p>
            <div className="mt-4 grid gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2">
                  <span className="field-label">Placement</span>
                  <select
                    value={placement}
                    onChange={(event) => {
                      setPlacement(event.target.value);
                      setSoilType(getSoilDefault(event.target.value));
                    }}
                    className="field-control"
                  >
                    {[
                      "Indoor collection",
                      "Balcony garden",
                      "Backyard garden",
                      "Terrace or rooftop garden",
                    ].map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2">
                  <span className="field-label">Sunlight</span>
                  <select value={sunlight} onChange={(event) => setSunlight(event.target.value)} className="field-control">
                    {["Low light", "Bright indirect", "Partial sun", "Full sun"].map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2">
                  <span className="field-label">Growth stage</span>
                  <select value={growthStage} onChange={(event) => setGrowthStage(event.target.value)} className="field-control">
                    {["seedling", "growing", "flowering", "fruiting", "dormant"].map((value) => (
                      <option key={value} value={value}>
                        {toLabel(value)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2">
                  <span className="field-label">
                    Soil{" "}
                    <span title={selectedSoil.description} className="ml-1 cursor-help text-xs text-[var(--color-muted)]">
                      ⓘ
                    </span>
                  </span>
                  <select value={soilType} onChange={(event) => setSoilType(event.target.value)} className="field-control">
                    {SOIL_OPTIONS.map((soil) => (
                      <option key={soil.value} value={soil.value}>
                        {soil.value}
                      </option>
                    ))}
                  </select>
                  <div className="surface-card-muted flex items-center gap-3 px-3 py-2">
                    <Image
                      src={selectedSoil.image}
                      alt={selectedSoil.value}
                      width={44}
                      height={44}
                      className="h-11 w-11 rounded-lg object-cover"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-[var(--color-ink)]">
                        {selectedSoil.icon} {selectedSoil.value}
                      </p>
                      <p className="text-xs text-[var(--color-muted)]">{selectedSoil.description}</p>
                    </div>
                  </div>
                </label>
              </div>

              <div className="grid gap-2">
                <span className="field-label">
                  Watering{" "}
                  <span
                    title="Choose how BloomPilot sets watering frequency for this plant."
                    className="ml-1 cursor-help text-xs text-[var(--color-muted)]"
                  >
                    ⓘ
                  </span>
                </span>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label
                    className={`choice-card cursor-pointer p-3 ${
                      wateringMode === "auto"
                        ? "border-[var(--color-moss)] ring-2 ring-[rgba(76,121,97,0.14)]"
                        : ""
                    }`}
                    title="Auto uses placement and sunlight to set watering days."
                  >
                    <input
                      type="radio"
                      name="watering-mode"
                      value="auto"
                      checked={wateringMode === "auto"}
                      onChange={() => setWateringMode("auto")}
                      className="mt-1 h-4 w-4 border-[rgba(16,52,39,0.3)] text-[var(--color-canopy)] focus:ring-[var(--color-moss)]"
                    />
                    <span className="space-y-1">
                      <span className="block text-sm font-medium text-[var(--color-ink)]">
                        Auto (recommended)
                      </span>
                      <span className="block text-xs leading-5 text-[var(--color-muted)]">
                        BloomPilot sets cadence from context.
                      </span>
                    </span>
                  </label>
                  <label
                    className={`choice-card cursor-pointer p-3 ${
                      wateringMode === "custom"
                        ? "border-[var(--color-moss)] ring-2 ring-[rgba(76,121,97,0.14)]"
                        : ""
                    }`}
                    title="Customize lets you set your own watering interval in days."
                  >
                    <input
                      type="radio"
                      name="watering-mode"
                      value="custom"
                      checked={wateringMode === "custom"}
                      onChange={() => setWateringMode("custom")}
                      className="mt-1 h-4 w-4 border-[rgba(16,52,39,0.3)] text-[var(--color-canopy)] focus:ring-[var(--color-moss)]"
                    />
                    <span className="space-y-1">
                      <span className="block text-sm font-medium text-[var(--color-ink)]">
                        Customize
                      </span>
                      <span className="block text-xs leading-5 text-[var(--color-muted)]">
                        Set your own interval in days.
                      </span>
                    </span>
                  </label>
                </div>
                {wateringMode === "custom" ? (
                  <label className="grid gap-2 sm:max-w-[260px]">
                    <span className="field-label">
                      Every X days{" "}
                      <span
                        title="Enter a number like 2, 3, or 7 to water every X days."
                        className="ml-1 cursor-help text-xs text-[var(--color-muted)]"
                      >
                        ⓘ
                      </span>
                    </span>
                    <input
                      value={customDays}
                      onChange={(event) => setCustomDays(event.target.value)}
                      type="number"
                      min="1"
                      className="field-control"
                      placeholder="e.g., 3"
                    />
                  </label>
                ) : (
                  <p className="field-hint">System will calculate watering cadence from environment and plant context.</p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={submitPlant} className="button-primary" disabled={!canSubmit}>
                {editingPlantId ? "Update plant" : "Add plant"}
              </button>
              <button type="button" onClick={resetDraft} className="button-secondary">
                Reset form
              </button>
            </div>
            {submitError ? (
              <p className="text-sm text-[var(--color-copper)]">{submitError}</p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="grid gap-3">
        <div className="flex items-center justify-between">
          <p className="font-accent text-sm font-semibold text-[var(--color-ink)]">Added plants</p>
          <p className="text-xs text-[var(--color-muted)]">{plants.length} total</p>
        </div>
      </div>
      {plants.length === 0 ? (
        <div className="landing-subtle-card rounded-2xl px-4 py-4 text-sm text-[var(--color-muted)]">
          No plants added yet. Add your first plant to continue.
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {plants.map((plant) => (
          <article key={plant.id} className="landing-card rounded-2xl p-4">
            {(() => {
              const noteMap = parseNotes(plant.notes);
              const plantSoil = noteMap.get("soil") || "Not set";
              const plantStage = noteMap.get("stage") || "growing";
              const plantWateringMode = noteMap.get("watering_mode") === "custom" ? "Custom" : "Auto";
              return (
                <>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">{placementIcon(plant.placement)}</span>
                <div>
                  <p className="text-sm font-semibold text-[var(--color-ink)]">{plant.nickname}</p>
                  <p className="text-xs text-[var(--color-muted)]">{plant.species}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => removePlant(plant.id)}
                className="rounded-lg border border-[var(--color-line)] px-2 py-1 text-xs text-[var(--color-muted)] hover:bg-[rgba(243,241,234,0.7)]"
                aria-label={`Delete ${plant.nickname}`}
              >
                Remove
              </button>
            </div>
            <div className="mt-3 grid gap-1 text-xs text-[var(--color-muted)]">
              <p className="truncate">Placement: {plant.placement}</p>
              <p>Stage: {toLabel(plantStage)}</p>
              <p>Watering: {plantWateringMode} · every {plant.wateringIntervalDays} days</p>
              <p className="truncate">Soil: {plantSoil}</p>
            </div>
            <PlantPhotoWidget plantId={plant.id} />
            <KnowledgeBadges plantId={plant.id} species={plant.species} />
            <div className="mt-3 flex items-center gap-3">
              <a
                href={`/garden/${plant.id}`}
                className="text-xs text-[var(--color-moss)] underline underline-offset-2 hover:text-[var(--color-ink)]"
              >
                View details
              </a>
              <button
                type="button"
                className="button-ghost h-9 px-0 text-xs"
                onClick={() => {
                  const noteMap = parseNotes(plant.notes);
                  const nextWateringMode = noteMap.get("watering_mode") === "custom" ? "custom" : "auto";
                  setEditingPlantId(plant.id);
                  setSelectedPlant({
                    commonName: plant.nickname,
                    species: plant.species,
                    source: "search",
                  });
                  setPlacement(plant.placement);
                  setSunlight(plant.sunlight);
                  setSoilType(noteMap.get("soil") || getSoilDefault(plant.placement));
                  setGrowthStage(noteMap.get("stage") || "growing");
                  setWateringMode(nextWateringMode);
                  setCustomDays(noteMap.get("custom_days") || `${plant.wateringIntervalDays}`);
                }}
              >
                Edit
              </button>
            </div>
                </>
              );
            })()}
          </article>
        ))}
      </div>
    </div>
  );
}

function toLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
