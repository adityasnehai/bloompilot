import { getDatabase } from "@/lib/database";
import { randomUUID } from "node:crypto";

export type SpeciesKnowledge = {
  id: string;
  speciesKey: string;
  scientificName: string | null;
  commonNames: string[];
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
  confidence: "high" | "medium" | "low" | "seeded";
  fetchedAt: string;
};

type KnowledgeRow = {
  id: string;
  species_key: string;
  scientific_name: string | null;
  common_names: string;
  watering_baseline: string | null;
  watering_days_min: number | null;
  watering_days_max: number | null;
  sunlight_preference: string | null;
  soil_preference: string | null;
  temperature_min_c: number | null;
  temperature_max_c: number | null;
  humidity_min_percent: number | null;
  humidity_max_percent: number | null;
  ph_min: number | null;
  ph_max: number | null;
  pest_list: string;
  disease_list: string;
  toxicity: string | null;
  pruning_months: string | null;
  nutrient_requirements: string | null;
  companion_plants: string;
  care_notes: string;
  sources: string;
  confidence: string;
  fetched_at: string;
};

function parseJson<T>(raw: string, fallback: T): T {
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

function rowToKnowledge(row: KnowledgeRow): SpeciesKnowledge {
  return {
    id: row.id,
    speciesKey: row.species_key,
    scientificName: row.scientific_name,
    commonNames: parseJson(row.common_names, []),
    wateringBaseline: row.watering_baseline,
    wateringDaysMin: row.watering_days_min,
    wateringDaysMax: row.watering_days_max,
    sunlightPreference: row.sunlight_preference,
    soilPreference: row.soil_preference,
    temperatureMinC: row.temperature_min_c,
    temperatureMaxC: row.temperature_max_c,
    humidityMinPercent: row.humidity_min_percent,
    humidityMaxPercent: row.humidity_max_percent,
    phMin: row.ph_min,
    phMax: row.ph_max,
    pestList: parseJson(row.pest_list, []),
    diseaseList: parseJson(row.disease_list, []),
    toxicity: row.toxicity,
    pruningMonths: row.pruning_months,
    nutrientRequirements: row.nutrient_requirements,
    companionPlants: parseJson(row.companion_plants, []),
    careNotes: parseJson(row.care_notes, []),
    sources: parseJson(row.sources, []),
    confidence: (row.confidence as SpeciesKnowledge["confidence"]) ?? "low",
    fetchedAt: row.fetched_at,
  };
}

export function normalizeSpeciesKey(species: string): string {
  return species.trim().toLowerCase().replace(/\s+/g, " ");
}

const STALE_DAYS = 90;

export async function getKnowledgeFromDB(species: string): Promise<SpeciesKnowledge | null> {
  const db = await getDatabase();
  const key = normalizeSpeciesKey(species);
  if (!key) return null;

  const row = await db
    .prepare(`SELECT * FROM plant_species_knowledge WHERE species_key = ?`)
    .get(key) as KnowledgeRow | undefined;

  if (!row) return null;

  const age = (Date.now() - new Date(row.fetched_at).getTime()) / 86400000;
  if (age > STALE_DAYS && row.confidence !== "seeded") return null;

  return rowToKnowledge(row);
}

export async function upsertKnowledge(k: Omit<SpeciesKnowledge, "id">): Promise<SpeciesKnowledge> {
  const db = await getDatabase();
  const id = randomUUID();

  await db.prepare(`
    INSERT INTO plant_species_knowledge (
      id, species_key, scientific_name, common_names,
      watering_baseline, watering_days_min, watering_days_max,
      sunlight_preference, soil_preference,
      temperature_min_c, temperature_max_c,
      humidity_min_percent, humidity_max_percent,
      ph_min, ph_max,
      pest_list, disease_list, toxicity, pruning_months,
      nutrient_requirements, companion_plants, care_notes,
      sources, confidence, fetched_at
    ) VALUES (
      ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?,
      ?, ?,
      ?, ?,
      ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?
    )
    ON CONFLICT(species_key) DO UPDATE SET
      scientific_name = excluded.scientific_name,
      common_names = excluded.common_names,
      watering_baseline = excluded.watering_baseline,
      watering_days_min = excluded.watering_days_min,
      watering_days_max = excluded.watering_days_max,
      sunlight_preference = excluded.sunlight_preference,
      soil_preference = excluded.soil_preference,
      temperature_min_c = excluded.temperature_min_c,
      temperature_max_c = excluded.temperature_max_c,
      humidity_min_percent = excluded.humidity_min_percent,
      humidity_max_percent = excluded.humidity_max_percent,
      ph_min = excluded.ph_min,
      ph_max = excluded.ph_max,
      pest_list = excluded.pest_list,
      disease_list = excluded.disease_list,
      toxicity = excluded.toxicity,
      pruning_months = excluded.pruning_months,
      nutrient_requirements = excluded.nutrient_requirements,
      companion_plants = excluded.companion_plants,
      care_notes = excluded.care_notes,
      sources = excluded.sources,
      confidence = excluded.confidence,
      fetched_at = excluded.fetched_at
  `).run(
    id, k.speciesKey, k.scientificName, JSON.stringify(k.commonNames),
    k.wateringBaseline, k.wateringDaysMin, k.wateringDaysMax,
    k.sunlightPreference, k.soilPreference,
    k.temperatureMinC, k.temperatureMaxC,
    k.humidityMinPercent, k.humidityMaxPercent,
    k.phMin, k.phMax,
    JSON.stringify(k.pestList), JSON.stringify(k.diseaseList),
    k.toxicity, k.pruningMonths,
    k.nutrientRequirements, JSON.stringify(k.companionPlants),
    JSON.stringify(k.careNotes),
    JSON.stringify(k.sources), k.confidence, k.fetchedAt,
  );

  return { id, ...k };
}

export async function getStaleKnowledgeKeys(limit = 50): Promise<string[]> {
  const db = await getDatabase();
  const cutoff = new Date(Date.now() - STALE_DAYS * 86400000).toISOString();
  const rows = await db
    .prepare(`SELECT species_key FROM plant_species_knowledge WHERE fetched_at < ? AND confidence != 'seeded' LIMIT ?`)
    .all(cutoff, limit) as { species_key: string }[];
  return rows.map((r) => r.species_key);
}

export async function getAllKnowledgeSpeciesKeys(): Promise<string[]> {
  const db = await getDatabase();
  const rows = await db.prepare(`SELECT species_key FROM plant_species_knowledge`).all() as { species_key: string }[];
  return rows.map((r) => r.species_key);
}
