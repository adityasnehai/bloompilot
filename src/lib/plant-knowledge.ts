import { getKnowledgeFromDB, type SpeciesKnowledge } from "@/lib/plant-knowledge-db";
import { enrichSpecies } from "@/lib/plant-enrichment";

export type PlantKnowledge = {
  source: string;
  watering_baseline: string | null;
  watering_days_min: number | null;
  watering_days_max: number | null;
  sunlight_preference: string | null;
  soil_preference: string | null;
  temperature_range_c: string | null;
  temperature_min_c: number | null;
  temperature_max_c: number | null;
  humidity_preference: string | null;
  humidity_min_percent: number | null;
  humidity_max_percent: number | null;
  ph_min: number | null;
  ph_max: number | null;
  pest_list: string[];
  disease_list: string[];
  toxicity: string | null;
  pruning_months: string | null;
  nutrient_requirements: string | null;
  companion_plants: string[];
  care_notes: string[];
  confidence: string;
};

function speciesKnowledgeToPlantKnowledge(k: SpeciesKnowledge): PlantKnowledge {
  const tempRange =
    k.temperatureMinC !== null && k.temperatureMaxC !== null
      ? `${k.temperatureMinC}-${k.temperatureMaxC}`
      : k.temperatureMinC !== null
        ? `${k.temperatureMinC}+`
        : null;

  const humidityPref =
    k.humidityMinPercent !== null && k.humidityMaxPercent !== null
      ? `${k.humidityMinPercent}-${k.humidityMaxPercent}%`
      : null;

  return {
    source: k.sources.length > 0 ? k.sources.join(", ") : "plant_knowledge_db",
    watering_baseline: k.wateringBaseline,
    watering_days_min: k.wateringDaysMin,
    watering_days_max: k.wateringDaysMax,
    sunlight_preference: k.sunlightPreference,
    soil_preference: k.soilPreference,
    temperature_range_c: tempRange,
    temperature_min_c: k.temperatureMinC,
    temperature_max_c: k.temperatureMaxC,
    humidity_preference: humidityPref,
    humidity_min_percent: k.humidityMinPercent,
    humidity_max_percent: k.humidityMaxPercent,
    ph_min: k.phMin,
    ph_max: k.phMax,
    pest_list: k.pestList,
    disease_list: k.diseaseList,
    toxicity: k.toxicity,
    pruning_months: k.pruningMonths,
    nutrient_requirements: k.nutrientRequirements,
    companion_plants: k.companionPlants,
    care_notes: k.careNotes,
    confidence: k.confidence,
  };
}

function emptyKnowledge(): PlantKnowledge {
  return {
    source: "unknown",
    watering_baseline: null,
    watering_days_min: null,
    watering_days_max: null,
    sunlight_preference: null,
    soil_preference: null,
    temperature_range_c: null,
    temperature_min_c: null,
    temperature_max_c: null,
    humidity_preference: null,
    humidity_min_percent: null,
    humidity_max_percent: null,
    ph_min: null,
    ph_max: null,
    pest_list: [],
    disease_list: [],
    toxicity: null,
    pruning_months: null,
    nutrient_requirements: null,
    companion_plants: [],
    care_notes: [],
    confidence: "low",
  };
}

export function normalizePlantKnowledge(rawData: Partial<PlantKnowledge> | null): PlantKnowledge {
  return {
    source: rawData?.source ?? "unknown",
    watering_baseline: rawData?.watering_baseline ?? null,
    watering_days_min: rawData?.watering_days_min ?? null,
    watering_days_max: rawData?.watering_days_max ?? null,
    sunlight_preference: rawData?.sunlight_preference ?? null,
    soil_preference: rawData?.soil_preference ?? null,
    temperature_range_c: rawData?.temperature_range_c ?? null,
    temperature_min_c: rawData?.temperature_min_c ?? null,
    temperature_max_c: rawData?.temperature_max_c ?? null,
    humidity_preference: rawData?.humidity_preference ?? null,
    humidity_min_percent: rawData?.humidity_min_percent ?? null,
    humidity_max_percent: rawData?.humidity_max_percent ?? null,
    ph_min: rawData?.ph_min ?? null,
    ph_max: rawData?.ph_max ?? null,
    pest_list: rawData?.pest_list ?? [],
    disease_list: rawData?.disease_list ?? [],
    toxicity: rawData?.toxicity ?? null,
    pruning_months: rawData?.pruning_months ?? null,
    nutrient_requirements: rawData?.nutrient_requirements ?? null,
    companion_plants: rawData?.companion_plants ?? [],
    care_notes: rawData?.care_notes ?? [],
    confidence: rawData?.confidence ?? "low",
  };
}

export async function getPlantCareKnowledge(species: string): Promise<PlantKnowledge> {
  const key = species.trim();
  if (!key) return emptyKnowledge();

  // 1. Check DB cache — returns null if missing or stale
  const cached = getKnowledgeFromDB(key);
  if (cached) return speciesKnowledgeToPlantKnowledge(cached);

  // 2. Enrich: fetches Perenual + Trefle in parallel, stores in DB, returns result
  try {
    const enriched = await enrichSpecies(key);
    if (enriched) return speciesKnowledgeToPlantKnowledge(enriched);
  } catch {
    // enrichment failure must not break context building
  }

  return emptyKnowledge();
}

export async function searchPlantCareKnowledge(query: string): Promise<PlantKnowledge[]> {
  const key = query.trim();
  if (!key) return [];

  const result = await getPlantCareKnowledge(key);
  if (result.source === "unknown") return [];
  return [result];
}
