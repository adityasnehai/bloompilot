import {
  getKnowledgeFromDB,
  upsertKnowledge,
  normalizeSpeciesKey,
  type SpeciesKnowledge,
} from "@/lib/plant-knowledge-db";

// ─── Perenual ────────────────────────────────────────────────────────────────

type PerenualSearchResult = {
  data?: Array<{ id: number; common_name?: string | null; scientific_name?: string[] | null }>;
};

type PerenualDetail = {
  watering?: string | null;
  watering_general_benchmark?: { value?: string | number | null; unit?: string | null } | null;
  sunlight?: string[] | null;
  soil?: string[] | null;
  pest_susceptibility?: string[] | null;
  maintenance?: string | null;
  poisonous_to_pets?: number | null;
  poisonous_to_humans?: number | null;
  growth_rate?: string | null;
  pruning_month?: string[] | null;
  common_name?: string | null;
  scientific_name?: string[] | null;
};

async function fetchPerenual(species: string): Promise<Partial<SpeciesKnowledge> | null> {
  const key = process.env.PERENUAL_API_KEY?.trim();
  if (!key) return null;

  try {
    const searchUrl = new URL("https://www.perenual.com/api/v2/species-list");
    searchUrl.searchParams.set("key", key);
    searchUrl.searchParams.set("q", species.trim());
    const searchRes = await fetch(searchUrl, { signal: AbortSignal.timeout(8000) });
    if (!searchRes.ok) return null;

    const searchData = (await searchRes.json()) as PerenualSearchResult;
    const match = searchData.data?.[0];
    if (!match?.id) return null;

    const detailUrl = new URL(`https://www.perenual.com/api/v2/species/details/${match.id}`);
    detailUrl.searchParams.set("key", key);
    const detailRes = await fetch(detailUrl, { signal: AbortSignal.timeout(8000) });
    if (!detailRes.ok) return null;

    const d = (await detailRes.json()) as PerenualDetail;

    const wateringBaseline = d.watering_general_benchmark?.value && d.watering_general_benchmark?.unit
      ? `Water every ${d.watering_general_benchmark.value} ${d.watering_general_benchmark.unit}`
      : normalizePerenualWatering(d.watering);

    const [daysMin, daysMax] = parseWateringDays(d.watering_general_benchmark);

    const toxicityParts: string[] = [];
    if (d.poisonous_to_pets) toxicityParts.push("toxic to pets");
    if (d.poisonous_to_humans) toxicityParts.push("toxic to humans");

    return {
      scientificName: d.scientific_name?.[0] ?? match.scientific_name?.[0] ?? null,
      commonNames: [d.common_name ?? match.common_name ?? ""].filter(Boolean),
      wateringBaseline,
      wateringDaysMin: daysMin,
      wateringDaysMax: daysMax,
      sunlightPreference: normalizeSunlight(d.sunlight),
      soilPreference: d.soil?.join(", ").toLowerCase() || null,
      pestList: d.pest_susceptibility?.filter(Boolean) ?? [],
      toxicity: toxicityParts.length > 0 ? toxicityParts.join(", ") : null,
      pruningMonths: d.pruning_month?.join(", ") ?? null,
    };
  } catch {
    return null;
  }
}

function normalizePerenualWatering(v: string | null | undefined): string | null {
  if (!v) return null;
  const k = v.toLowerCase();
  if (k.includes("frequent")) return "Water when top 2-3 cm soil dries (frequent)";
  if (k.includes("average")) return "Water when top 3-5 cm soil dries (moderate)";
  if (k.includes("minimum")) return "Water only when soil is mostly dry (low frequency)";
  return v;
}

function normalizeSunlight(v: string[] | null | undefined): string | null {
  if (!v?.length) return null;
  const t = v.join(", ").toLowerCase();
  if (t.includes("full sun")) return "full_sun";
  if (t.includes("part shade") || t.includes("partial")) return "partial_sun";
  if (t.includes("indirect")) return "bright_indirect";
  if (t.includes("shade") || t.includes("low")) return "low_light";
  return v.join(", ");
}

function parseWateringDays(
  benchmark: PerenualDetail["watering_general_benchmark"],
): [number | null, number | null] {
  if (!benchmark?.value || !benchmark?.unit) return [null, null];
  const val = Number(benchmark.value);
  if (isNaN(val)) return [null, null];
  const unit = String(benchmark.unit).toLowerCase();
  if (unit.includes("day")) return [Math.max(1, val - 1), val + 1];
  if (unit.includes("week")) return [val * 7 - 2, val * 7 + 2];
  return [null, null];
}

// ─── Trefle ──────────────────────────────────────────────────────────────────

type TrefleSearchResult = {
  data?: Array<{ id: number; common_name?: string | null; scientific_name?: string | null }>;
};

type TrefleDetail = {
  data?: {
    common_name?: string | null;
    scientific_name?: string | null;
    main_species?: {
      growth?: {
        minimum_temperature?: { deg_c?: number | null } | null;
        maximum_temperature?: { deg_c?: number | null } | null;
        ph_minimum?: number | null;
        ph_maximum?: number | null;
        atmospheric_humidity?: number | null;
        light?: number | null;
        soil_humidity?: number | null;
        soil_nutriments?: number | null;
      } | null;
    } | null;
  } | null;
};

async function fetchTrefle(species: string): Promise<Partial<SpeciesKnowledge> | null> {
  const token = process.env.TREFLE_API_KEY?.trim();
  if (!token) return null;

  try {
    const searchUrl = new URL("https://trefle.io/api/v1/plants/search");
    searchUrl.searchParams.set("token", token);
    searchUrl.searchParams.set("q", species.trim());
    const searchRes = await fetch(searchUrl, { signal: AbortSignal.timeout(8000) });
    if (!searchRes.ok) return null;

    const searchData = (await searchRes.json()) as TrefleSearchResult;
    const match = searchData.data?.[0];
    if (!match?.id) return null;

    const detailUrl = new URL(`https://trefle.io/api/v1/plants/${match.id}`);
    detailUrl.searchParams.set("token", token);
    const detailRes = await fetch(detailUrl, { signal: AbortSignal.timeout(8000) });
    if (!detailRes.ok) return null;

    const detail = (await detailRes.json()) as TrefleDetail;
    const growth = detail.data?.main_species?.growth;
    if (!growth) return null;

    const humidityRaw = growth.atmospheric_humidity;
    let humidityMin: number | null = null;
    let humidityMax: number | null = null;
    if (humidityRaw !== null && humidityRaw !== undefined) {
      humidityMin = Math.max(0, (humidityRaw - 2) * 10);
      humidityMax = Math.min(100, (humidityRaw + 2) * 10);
    }

    const nutrientLevel = growth.soil_nutriments;
    const nutrientReqs = nutrientLevel !== null && nutrientLevel !== undefined
      ? nutrientLevel >= 7 ? "High — feed every 2 weeks during growing season"
        : nutrientLevel >= 4 ? "Moderate — feed monthly during growing season"
        : "Low — feed every 6-8 weeks"
      : null;

    return {
      temperatureMinC: growth.minimum_temperature?.deg_c ?? null,
      temperatureMaxC: growth.maximum_temperature?.deg_c ?? null,
      phMin: growth.ph_minimum ?? null,
      phMax: growth.ph_maximum ?? null,
      humidityMinPercent: humidityMin,
      humidityMaxPercent: humidityMax,
      nutrientRequirements: nutrientReqs,
    };
  } catch {
    return null;
  }
}

// ─── Merge ───────────────────────────────────────────────────────────────────

function merge(
  species: string,
  perenual: Partial<SpeciesKnowledge> | null,
  trefle: Partial<SpeciesKnowledge> | null,
): Omit<SpeciesKnowledge, "id"> {
  const sources: string[] = [];
  if (perenual) sources.push("perenual");
  if (trefle) sources.push("trefle");

  const confidence: SpeciesKnowledge["confidence"] =
    sources.length >= 2 ? "high" : sources.length === 1 ? "medium" : "low";

  return {
    speciesKey: normalizeSpeciesKey(species),
    scientificName: perenual?.scientificName ?? trefle?.speciesKey ?? null,
    commonNames: perenual?.commonNames ?? [],
    wateringBaseline: perenual?.wateringBaseline ?? null,
    wateringDaysMin: perenual?.wateringDaysMin ?? null,
    wateringDaysMax: perenual?.wateringDaysMax ?? null,
    sunlightPreference: perenual?.sunlightPreference ?? null,
    soilPreference: perenual?.soilPreference ?? null,
    temperatureMinC: trefle?.temperatureMinC ?? null,
    temperatureMaxC: trefle?.temperatureMaxC ?? null,
    humidityMinPercent: trefle?.humidityMinPercent ?? null,
    humidityMaxPercent: trefle?.humidityMaxPercent ?? null,
    phMin: trefle?.phMin ?? null,
    phMax: trefle?.phMax ?? null,
    pestList: perenual?.pestList ?? [],
    diseaseList: [],
    toxicity: perenual?.toxicity ?? null,
    pruningMonths: perenual?.pruningMonths ?? null,
    nutrientRequirements: trefle?.nutrientRequirements ?? null,
    companionPlants: [],
    careNotes: [],
    sources,
    confidence,
    fetchedAt: new Date().toISOString(),
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function enrichSpecies(species: string): Promise<SpeciesKnowledge> {
  const cached = getKnowledgeFromDB(species);
  if (cached) return cached;

  const [perenual, trefle] = await Promise.allSettled([
    fetchPerenual(species),
    fetchTrefle(species),
  ]);

  const perenualData = perenual.status === "fulfilled" ? perenual.value : null;
  const trefleData = trefle.status === "fulfilled" ? trefle.value : null;

  const merged = merge(species, perenualData, trefleData);

  if (merged.confidence === "low") {
    const seeded = SEED_KNOWLEDGE[normalizeSpeciesKey(species)];
    if (seeded) return upsertKnowledge(seeded);
  }

  return upsertKnowledge(merged);
}

export async function enrichSpeciesBatch(speciesList: string[]): Promise<void> {
  await Promise.allSettled(speciesList.map((s) => enrichSpecies(s)));
}

// ─── Seed data — 50 most common plants ───────────────────────────────────────

type SeedEntry = Omit<SpeciesKnowledge, "id">;

export const SEED_KNOWLEDGE: Record<string, SeedEntry> = buildSeed();

function s(
  key: string,
  scientificName: string,
  commonNames: string[],
  wateringBaseline: string,
  daysMin: number,
  daysMax: number,
  sunlight: string,
  soil: string,
  tempMin: number,
  tempMax: number,
  humMin: number,
  humMax: number,
  phMin: number,
  phMax: number,
  pests: string[],
  toxicity: string | null,
  nutrient: string,
  notes: string[],
): SeedEntry {
  return {
    speciesKey: key,
    scientificName,
    commonNames,
    wateringBaseline,
    wateringDaysMin: daysMin,
    wateringDaysMax: daysMax,
    sunlightPreference: sunlight,
    soilPreference: soil,
    temperatureMinC: tempMin,
    temperatureMaxC: tempMax,
    humidityMinPercent: humMin,
    humidityMaxPercent: humMax,
    phMin,
    phMax,
    pestList: pests,
    diseaseList: [],
    toxicity,
    pruningMonths: null,
    nutrientRequirements: nutrient,
    companionPlants: [],
    careNotes: notes,
    sources: ["seed_v1"],
    confidence: "seeded",
    fetchedAt: new Date().toISOString(),
  };
}

function buildSeed(): Record<string, SeedEntry> {
  const entries: SeedEntry[] = [
    s("monstera deliciosa", "Monstera deliciosa", ["Swiss Cheese Plant", "Monstera"],
      "Water when top 3-4 cm soil dries, every 7-10 days", 7, 10,
      "bright_indirect", "well_draining_potting_mix", 18, 30, 50, 80, 5.5, 7.0,
      ["spider mites", "scale", "mealybugs"], "toxic to pets and humans",
      "Moderate — feed monthly in spring/summer",
      ["Wipe leaves to improve photosynthesis", "Provide a moss pole as it matures"]),

    s("epipremnum aureum", "Epipremnum aureum", ["Pothos", "Money Plant", "Devil's Ivy"],
      "Water when top 2-3 cm soil dries, every 5-8 days", 5, 8,
      "bright_indirect", "well_draining_potting_mix", 15, 30, 40, 80, 6.0, 6.5,
      ["mealybugs", "spider mites"], "toxic to pets and humans",
      "Low — feed every 6-8 weeks",
      ["Tolerates low light but grows faster in bright indirect", "Trail or climb — very versatile"]),

    s("sansevieria trifasciata", "Sansevieria trifasciata", ["Snake Plant", "Mother-in-Law's Tongue"],
      "Allow soil to fully dry between watering, every 10-14 days", 10, 14,
      "low_light_to_bright_indirect", "well_draining_cactus_mix", 15, 32, 30, 60, 5.5, 7.5,
      ["spider mites", "mealybugs"], "mildly toxic to pets",
      "Low — feed every 2-3 months",
      ["Overwatering is the primary killer", "Excellent air purifier"]),

    s("spathiphyllum wallisii", "Spathiphyllum wallisii", ["Peace Lily"],
      "Keep soil slightly moist, water every 5-7 days", 5, 7,
      "low_light_to_bright_indirect", "rich_well_draining_mix", 18, 30, 50, 85, 5.8, 6.5,
      ["spider mites", "aphids", "mealybugs"], "toxic to pets and humans",
      "Moderate — feed monthly in growing season",
      ["Drooping leaves signal thirst — usually recovers quickly after watering", "Thrives in humid bathrooms"]),

    s("zamioculcas zamiifolia", "Zamioculcas zamiifolia", ["ZZ Plant", "Zanzibar Gem"],
      "Allow soil to dry completely, every 14-21 days", 14, 21,
      "low_light_to_bright_indirect", "well_draining_potting_mix", 15, 35, 30, 60, 6.0, 7.0,
      ["aphids", "mealybugs"], "toxic to pets and humans",
      "Low — feed every 3-4 months",
      ["Extremely drought tolerant", "Rhizomes store water — never leave in standing water"]),

    s("chlorophytum comosum", "Chlorophytum comosum", ["Spider Plant"],
      "Keep evenly moist, water every 5-7 days in summer, every 10-14 in winter", 5, 10,
      "bright_indirect", "well_draining_potting_mix", 13, 27, 40, 70, 6.0, 6.5,
      ["spider mites", "aphids", "whitefly"], null,
      "Moderate — feed every 2 weeks in spring/summer",
      ["Brown tips indicate fluoride sensitivity or low humidity", "Great air purifier"]),

    s("ficus lyrata", "Ficus lyrata", ["Fiddle Leaf Fig"],
      "Water when top 3-5 cm soil dries, every 7-10 days", 7, 10,
      "bright_indirect_to_partial_sun", "well_draining_loamy", 16, 30, 30, 65, 6.0, 7.0,
      ["spider mites", "scale", "aphids"], "mildly toxic to pets",
      "Moderate — feed monthly in spring/summer",
      ["Hates being moved — choose a spot and leave it", "Wipe large leaves monthly"]),

    s("ficus elastica", "Ficus elastica", ["Rubber Plant", "Rubber Tree"],
      "Water when top 2-3 cm soil dries, every 7-10 days", 7, 10,
      "bright_indirect", "well_draining_loamy", 15, 30, 40, 70, 5.5, 7.0,
      ["spider mites", "scale", "mealybugs"], "mildly toxic to pets",
      "Moderate — feed every 2 weeks in growing season",
      ["Wipe leaves to keep them glossy", "Prune to control height and promote branching"]),

    s("aloe vera", "Aloe barbadensis miller", ["Aloe Vera"],
      "Water deeply only after soil fully dries, every 14-21 days", 14, 21,
      "full_sun_to_partial_sun", "sandy_cactus_mix", 13, 35, 20, 50, 7.0, 8.5,
      ["mealybugs", "scale", "aphids"], "toxic to pets if ingested",
      "Low — feed once in spring only",
      ["Overwatering causes root rot — when in doubt, skip watering", "Use pot with drainage holes"]),

    s("philodendron hederaceum", "Philodendron hederaceum", ["Heartleaf Philodendron"],
      "Water when top 2-3 cm dries, every 7-10 days", 7, 10,
      "bright_indirect", "well_draining_potting_mix", 18, 30, 50, 80, 6.0, 7.0,
      ["aphids", "mealybugs", "spider mites"], "toxic to pets and humans",
      "Moderate — feed monthly in spring/summer",
      ["Very forgiving and fast-growing", "Trails beautifully or climbs with support"]),

    s("calathea orbifolia", "Calathea orbifolia", ["Calathea", "Prayer Plant"],
      "Keep evenly moist, water every 5-7 days", 5, 7,
      "low_light_to_bright_indirect", "well_draining_rich_mix", 18, 28, 60, 90, 6.0, 6.5,
      ["spider mites", "fungus gnats"], null,
      "Moderate — feed monthly in growing season",
      ["Use distilled or rainwater — sensitive to fluoride", "Leaves fold up at night"]),

    s("crassula ovata", "Crassula ovata", ["Jade Plant", "Money Tree"],
      "Allow soil to dry completely, every 14-21 days", 14, 21,
      "full_sun_to_partial_sun", "sandy_cactus_mix", 10, 30, 20, 50, 6.0, 7.5,
      ["mealybugs", "spider mites", "scale"], null,
      "Low — feed once in spring with diluted fertilizer",
      ["Overwatering is the main threat", "Leaves wrinkle when thirsty"]),

    s("nephrolepis exaltata", "Nephrolepis exaltata", ["Boston Fern"],
      "Keep consistently moist, water every 3-5 days", 3, 5,
      "bright_indirect", "rich_well_draining_mix", 15, 25, 70, 90, 5.0, 5.5,
      ["spider mites", "scale", "mealybugs"], null,
      "Moderate — feed monthly in spring/summer",
      ["High humidity is essential — mist daily or use a pebble tray", "Fronds yellow if underwatered"]),

    s("anthurium andraeanum", "Anthurium andraeanum", ["Anthurium", "Flamingo Flower"],
      "Water when top 2-3 cm dries, every 7-10 days", 7, 10,
      "bright_indirect", "well_draining_orchid_mix", 18, 28, 60, 80, 5.5, 6.5,
      ["mealybugs", "spider mites", "scale"], "toxic to pets and humans",
      "Moderate — feed every 6 weeks with phosphorus-rich fertilizer",
      ["Bright indirect light promotes more blooms", "Avoid cold drafts"]),

    s("dracaena marginata", "Dracaena marginata", ["Dragon Tree", "Madagascar Dragon Tree"],
      "Allow top half of soil to dry, water every 10-14 days", 10, 14,
      "bright_indirect", "well_draining_potting_mix", 15, 32, 30, 60, 6.0, 7.0,
      ["spider mites", "scale", "mealybugs"], "toxic to pets",
      "Low — feed every 2-3 months",
      ["Tolerates neglect well", "Brown tips indicate fluoride or overwatering"]),

    s("orchid phalaenopsis", "Phalaenopsis", ["Moth Orchid", "Phalaenopsis Orchid"],
      "Water thoroughly every 7-10 days, allow to almost dry between", 7, 10,
      "bright_indirect", "orchid_bark_mix", 18, 30, 50, 80, 5.5, 6.5,
      ["mealybugs", "spider mites", "scale"], null,
      "Low — use orchid fertilizer every 2 weeks during bloom",
      ["Never let roots sit in water", "Roots should look silver-green when dry, green when watered"]),

    s("mangifera indica", "Mangifera indica", ["Mango Tree"],
      "Deep water every 3-5 days in heat, reduce in cooler weather", 3, 7,
      "full_sun", "well_draining_loamy", 20, 38, 50, 80, 5.5, 7.5,
      ["mango hopper", "mealybugs", "powdery mildew"], null,
      "High — feed NPK 6-6-6 every 2 months in growing season",
      ["Young trees need more frequent watering", "Clear trunk zone to reduce fungal risk"]),

    s("ocimum basilicum", "Ocimum basilicum", ["Basil", "Sweet Basil"],
      "Keep moist — water when top 1-2 cm dries, every 1-3 days", 1, 3,
      "full_sun", "fertile_well_draining", 18, 32, 50, 80, 6.0, 7.0,
      ["aphids", "whitefly", "thrips"], null,
      "Moderate — feed every 2-3 weeks with nitrogen-rich fertilizer",
      ["Pinch flower buds to extend leaf production", "Water at base to prevent fungal issues"]),

    s("mentha", "Mentha", ["Mint", "Spearmint", "Peppermint"],
      "Keep consistently moist, water every 2-4 days", 2, 4,
      "partial_sun_to_bright_indirect", "rich_moist_well_draining", 10, 25, 50, 70, 6.0, 7.0,
      ["aphids", "spider mites", "mint beetle"], null,
      "Moderate — feed every 2 weeks in growing season",
      ["Grows aggressively — keep in containers", "Harvest regularly to promote bushiness"]),

    s("solanum lycopersicum", "Solanum lycopersicum", ["Tomato"],
      "Keep evenly moist — water every 1-3 days in warm weather", 1, 3,
      "full_sun", "loamy_rich_organic", 18, 30, 50, 70, 6.0, 6.8,
      ["aphids", "whitefly", "tomato hornworm", "blight"], null,
      "High — feed NPK 5-10-10 every 2 weeks during fruiting",
      ["Avoid wetting foliage to prevent blight", "Stake or cage as plant grows"]),

    s("rosa", "Rosa", ["Rose"],
      "Deep water 2-3 times weekly, adjust for heat and rainfall", 2, 4,
      "full_sun", "loamy_well_draining", 15, 30, 40, 70, 6.0, 6.5,
      ["aphids", "spider mites", "black spot", "powdery mildew"], null,
      "High — feed rose fertilizer every 2-3 weeks in growing season",
      ["Prune dead blooms to encourage new flowers", "Morning watering reduces fungal risk"]),

    s("lavandula", "Lavandula", ["Lavender"],
      "Allow soil to dry completely between watering, every 10-14 days", 10, 14,
      "full_sun", "sandy_well_draining", 5, 30, 20, 50, 6.5, 7.5,
      ["aphids", "whitefly"], null,
      "Low — no regular fertilizer needed",
      ["Excellent drainage is essential — roots rot in wet soil", "Prune after flowering to maintain shape"]),

    s("capsicum annuum", "Capsicum annuum", ["Chilli Pepper", "Bell Pepper", "Capsicum"],
      "Keep evenly moist, water every 2-3 days in warm weather", 2, 3,
      "full_sun", "loamy_well_draining", 20, 35, 50, 75, 6.0, 6.8,
      ["aphids", "spider mites", "whitefly"], null,
      "Moderate — feed potassium-rich fertilizer every 2 weeks during fruiting",
      ["High temperatures (35°C+) cause flower drop", "Stake when fruiting heavily"]),

    s("citrus limon", "Citrus limon", ["Lemon Tree", "Lemon"],
      "Water deeply every 5-7 days, less in winter", 5, 7,
      "full_sun", "well_draining_sandy_loam", 10, 35, 50, 70, 6.0, 7.0,
      ["citrus leafminer", "scale", "aphids", "mealybugs"], null,
      "High — feed citrus fertilizer every 6 weeks in growing season",
      ["Yellowing leaves indicate iron or nitrogen deficiency", "Protect from frost below 5°C"]),

    s("jasminum", "Jasminum sambac", ["Jasmine"],
      "Keep moist during growing season, water every 3-5 days", 3, 5,
      "full_sun_to_partial_sun", "well_draining_loamy", 15, 35, 50, 70, 6.0, 7.5,
      ["aphids", "spider mites", "mealybugs"], null,
      "Moderate — feed balanced fertilizer monthly in spring/summer",
      ["Prune after flowering to encourage bushy growth", "Fragrance is strongest in evening"]),

    s("bambusa", "Bambusa", ["Bamboo"],
      "Keep consistently moist, water every 3-5 days", 3, 5,
      "full_sun_to_partial_sun", "well_draining_loamy", 10, 38, 50, 80, 5.5, 7.0,
      ["aphids", "mealybugs", "bamboo mite"], null,
      "High — feed nitrogen-rich fertilizer every month in growing season",
      ["Clumping varieties are less invasive than running types", "Mulch heavily to retain moisture"]),

    s("succulents", "Various", ["Succulent", "Succulents"],
      "Allow soil to fully dry, water every 14-21 days", 14, 21,
      "full_sun_to_partial_sun", "sandy_cactus_mix", 5, 40, 10, 50, 6.0, 7.5,
      ["mealybugs", "aphids", "scale"], null,
      "Very Low — feed diluted fertilizer once in spring",
      ["Always use pots with drainage holes", "Err on the side of underwatering"]),

    s("cactus", "Various Cactaceae", ["Cactus"],
      "Water deeply then allow complete drying, every 14-28 days", 14, 28,
      "full_sun", "sandy_cactus_mix", 7, 45, 10, 40, 6.0, 7.5,
      ["mealybugs", "scale", "spider mites"], null,
      "Very Low — feed diluted cactus fertilizer once in spring",
      ["Root rot from overwatering is the top killer", "Needs bright direct light"]),

    s("fittonia albivenis", "Fittonia albivenis", ["Nerve Plant", "Mosaic Plant"],
      "Keep consistently moist, water every 3-5 days", 3, 5,
      "low_light_to_bright_indirect", "well_draining_rich_mix", 16, 27, 60, 90, 6.0, 6.5,
      ["aphids", "mealybugs"], null,
      "Low — feed monthly in spring/summer",
      ["Droops dramatically when thirsty — recovers quickly", "Ideal for terrariums"]),

    s("tradescantia zebrina", "Tradescantia zebrina", ["Wandering Jew", "Spiderwort"],
      "Keep evenly moist, water every 5-7 days", 5, 7,
      "bright_indirect", "well_draining_potting_mix", 15, 30, 40, 70, 6.0, 6.5,
      ["spider mites", "aphids"], "mildly irritating to pets",
      "Low — feed monthly in growing season",
      ["Pinch tips to encourage bushy growth", "Fast grower — prune regularly"]),

    s("begonia", "Begonia", ["Begonia"],
      "Water when top 2 cm dries, every 5-7 days", 5, 7,
      "bright_indirect", "well_draining_rich_mix", 15, 27, 50, 70, 5.5, 6.5,
      ["powdery mildew", "botrytis", "mealybugs"], "mildly toxic to pets",
      "Moderate — feed balanced fertilizer every 2 weeks in bloom",
      ["Avoid wetting leaves to prevent mildew", "Deadhead to prolong flowering"]),

    s("aglaonema", "Aglaonema", ["Chinese Evergreen"],
      "Water when top 3 cm dries, every 7-10 days", 7, 10,
      "low_light_to_bright_indirect", "well_draining_potting_mix", 15, 30, 40, 70, 6.0, 6.5,
      ["mealybugs", "spider mites", "scale"], "toxic to pets",
      "Low — feed every 6-8 weeks in growing season",
      ["One of the most adaptable houseplants", "Avoid cold drafts and temperatures below 13°C"]),

    s("croton codiaeum", "Codiaeum variegatum", ["Croton"],
      "Water when top 2-3 cm dries, every 5-7 days", 5, 7,
      "full_sun_to_bright_indirect", "well_draining_rich_mix", 18, 30, 50, 80, 5.0, 6.5,
      ["spider mites", "mealybugs", "scale"], "mildly toxic to pets",
      "Moderate — feed monthly in spring/summer",
      ["Leaves drop in low light or cold drafts", "Colors are most vivid in bright light"]),

    s("peperomia", "Peperomia", ["Peperomia", "Radiator Plant"],
      "Allow top half to dry, water every 7-14 days", 7, 14,
      "bright_indirect", "well_draining_potting_mix", 15, 28, 40, 65, 6.0, 7.0,
      ["fungus gnats", "mealybugs"], null,
      "Low — feed monthly in spring/summer",
      ["Stores water in thick leaves — drought tolerant", "Root rot is the main risk"]),

    s("pothos golden", "Epipremnum aureum 'Golden'", ["Golden Pothos"],
      "Water when top 2-3 cm dries, every 5-8 days", 5, 8,
      "low_light_to_bright_indirect", "well_draining_potting_mix", 15, 30, 40, 80, 6.0, 6.5,
      ["mealybugs", "spider mites"], "toxic to pets and humans",
      "Low — feed every 6-8 weeks",
      ["Variegation fades in low light", "Very forgiving — good for beginners"]),

    s("syngonium podophyllum", "Syngonium podophyllum", ["Arrowhead Plant", "Nephthytis"],
      "Water when top 2-3 cm dries, every 5-7 days", 5, 7,
      "bright_indirect", "well_draining_potting_mix", 16, 28, 50, 80, 5.5, 6.5,
      ["spider mites", "aphids", "mealybugs"], "toxic to pets and humans",
      "Moderate — feed monthly in spring/summer",
      ["Leaf shape changes as plant matures", "Prune to keep compact"]),

    s("alocasia", "Alocasia", ["Elephant Ear", "Alocasia"],
      "Keep evenly moist, water every 5-7 days", 5, 7,
      "bright_indirect", "well_draining_rich_mix", 18, 30, 60, 85, 5.5, 6.5,
      ["spider mites", "mealybugs", "scale"], "toxic to pets and humans",
      "High — feed every 2 weeks in growing season",
      ["Goes dormant in winter — reduce watering significantly", "Needs high humidity"]),

    s("hoya carnosa", "Hoya carnosa", ["Wax Plant", "Hoya"],
      "Allow to almost dry between watering, every 10-14 days", 10, 14,
      "bright_indirect", "well_draining_potting_mix", 15, 30, 40, 70, 6.0, 7.0,
      ["mealybugs", "aphids", "scale"], null,
      "Low — feed monthly in growing season",
      ["Do not remove spent flower spurs — new blooms grow from them", "Slightly root-bound plants bloom more"]),

    s("caladium", "Caladium", ["Caladium", "Angel Wings"],
      "Keep evenly moist, water every 3-5 days", 3, 5,
      "bright_indirect", "well_draining_rich_mix", 20, 35, 60, 90, 5.5, 6.5,
      ["aphids", "thrips", "spider mites"], "toxic to pets and humans",
      "Moderate — feed every 2 weeks in growing season",
      ["Goes dormant in winter — store tubers dry", "High humidity essential for best color"]),

    s("strelitzia reginae", "Strelitzia reginae", ["Bird of Paradise"],
      "Water deeply every 7-10 days, allow top 5 cm to dry", 7, 10,
      "full_sun_to_bright_indirect", "well_draining_loamy", 12, 32, 30, 70, 6.0, 7.0,
      ["scale", "mealybugs", "spider mites"], null,
      "Moderate — feed balanced fertilizer monthly in spring/summer",
      ["Needs very bright light to bloom indoors", "Prefers being slightly root-bound"]),

    s("canna", "Canna", ["Canna Lily"],
      "Keep consistently moist, water every 2-4 days in heat", 2, 4,
      "full_sun", "rich_moist_well_draining", 15, 38, 60, 80, 6.0, 8.0,
      ["thrips", "canna leaf roller", "spider mites"], null,
      "High — feed balanced fertilizer every 2-3 weeks",
      ["Deadhead spent flowers for continuous blooming", "Lift rhizomes in frost-prone areas"]),

    s("impatiens", "Impatiens walleriana", ["Impatiens", "Busy Lizzie"],
      "Keep consistently moist, water every 2-3 days", 2, 3,
      "partial_shade_to_bright_indirect", "rich_well_draining_mix", 12, 28, 50, 80, 6.0, 6.5,
      ["downy mildew", "aphids", "spider mites"], null,
      "Moderate — feed every 2 weeks in bloom",
      ["Wilts quickly when underwatered but recovers fast", "Shade tolerant — good for dark spots"]),

    s("hibiscus rosa-sinensis", "Hibiscus rosa-sinensis", ["Hibiscus", "Chinese Hibiscus"],
      "Water thoroughly every 3-5 days, reduce in winter", 3, 5,
      "full_sun", "well_draining_loamy", 15, 38, 50, 80, 6.0, 7.0,
      ["whitefly", "aphids", "spider mites", "mealybugs"], null,
      "High — feed high-potassium fertilizer every 2 weeks in growing season",
      ["Needs 6+ hours direct sun for best blooms", "Prune in spring to encourage branching"]),

    s("maranta leuconeura", "Maranta leuconeura", ["Prayer Plant"],
      "Keep evenly moist, water every 5-7 days", 5, 7,
      "bright_indirect", "well_draining_rich_mix", 18, 28, 60, 90, 5.5, 6.0,
      ["spider mites", "mealybugs", "aphids"], null,
      "Moderate — feed every 2 weeks in spring/summer",
      ["Leaves fold up at night", "Use distilled water — sensitive to minerals"]),

    s("dieffenbachia", "Dieffenbachia", ["Dumb Cane"],
      "Water when top 3 cm dries, every 7-10 days", 7, 10,
      "bright_indirect", "well_draining_potting_mix", 18, 30, 50, 80, 6.0, 7.0,
      ["mealybugs", "spider mites", "scale"], "highly toxic to pets and humans",
      "Moderate — feed monthly in spring/summer",
      ["Sap causes mouth numbing — handle with care", "Lower leaves yellow naturally over time"]),

    s("schefflera", "Schefflera arboricola", ["Umbrella Plant", "Schefflera"],
      "Water when top 3-5 cm dries, every 7-10 days", 7, 10,
      "bright_indirect_to_partial_sun", "well_draining_potting_mix", 15, 30, 40, 70, 6.0, 6.5,
      ["spider mites", "scale", "aphids"], "mildly toxic to pets",
      "Moderate — feed every 2 months in growing season",
      ["Drops leaves in low light or overwatering", "Can grow into a large specimen over time"]),

    s("asparagus fern", "Asparagus setaceus", ["Asparagus Fern"],
      "Keep evenly moist, water every 5-7 days", 5, 7,
      "bright_indirect_to_partial_sun", "well_draining_potting_mix", 13, 28, 40, 70, 6.0, 6.5,
      ["spider mites", "mealybugs", "scale"], "mildly toxic to pets",
      "Moderate — feed monthly in spring/summer",
      ["Not a true fern — more drought tolerant than ferns", "Yellow needles indicate underwatering or low humidity"]),
  ];

  return Object.fromEntries(entries.map((e) => [e.speciesKey, e]));
}

export async function seedKnowledgeBase(): Promise<number> {
  let seeded = 0;
  for (const [key, entry] of Object.entries(SEED_KNOWLEDGE)) {
    const existing = getKnowledgeFromDB(key);
    if (!existing) {
      upsertKnowledge(entry);
      seeded++;
    }
  }
  return seeded;
}
