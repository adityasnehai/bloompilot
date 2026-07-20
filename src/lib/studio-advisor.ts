import { getGardenTypeProfile } from "@/lib/garden-type";
import type { PlantKnowledge } from "@/lib/plant-knowledge";

export type StudioGardenType = "balcony" | "terrace" | "indoor" | "backyard";
export type StudioLightReq = "full_sun" | "partial_shade" | "shade";

export type StudioPlant = {
  id: string;
  commonName: string;
  species: string;
  imageUrl?: string;
  lightReq: StudioLightReq;
  waterDays: number;
  x: number;
  z: number;
};

export type StudioContextPlant = {
  common_name: string;
  species: string | null;
  placement: string;
  sunlight: {
    label: string;
    direct_sun_hours_range: string;
    description: string;
  };
  soil: {
    type: string;
    drainage: string;
    user_confirmed: boolean;
  };
  watering: {
    mode: "auto" | "custom";
    custom_interval_days: number | null;
  };
  pot_profile: {
    size: "small" | "medium" | "large";
    material: "plastic" | "ceramic" | "terracotta" | "fabric";
    drainage_holes: boolean;
    substrate_mix: "balanced" | "high_organic" | "high_mineral";
  };
  plant_knowledge: PlantKnowledge;
  studio_zone: StudioLightReq | null;
};

export type StudioSuggestionKind = "placement" | "companion" | "setup";
export type StudioSuggestionSeverity = "good" | "warning" | "critical";

export type StudioSuggestion = {
  id: string;
  kind: StudioSuggestionKind;
  severity: StudioSuggestionSeverity;
  plantIds: string[];
  plantNames: string[];
  title: string;
  detail: string;
  evidence: string[];
  targetZone?: StudioLightReq;
  direction?: "forward" | "backward" | "group" | "separate";
  score: number;
};

export type StudioAdviceSummary = {
  totalPlants: number;
  alignedPlants: number;
  needsMove: number;
  companionLinks: number;
  speciesEvidencePlants: number;
  configuredOnlyPlants: number;
  overallNote: string;
};

export type StudioPlantInsight = {
  plantId: string;
  plantName: string;
  currentZone: StudioLightReq;
  targetZone: StudioLightReq;
  fitScore: number;
  severity: StudioSuggestionSeverity;
  direction: "forward" | "backward" | "group";
  moveMeters?: number;
  summary: string;
  evidence: string[];
  nearestPlantName?: string;
  nearestDistanceMeters?: number;
};

export type StudioAdviceResult = {
  summary: StudioAdviceSummary;
  plantInsights: StudioPlantInsight[];
  suggestions: StudioSuggestion[];
};

const LEVEL: Record<StudioLightReq, number> = {
  shade: 0,
  partial_shade: 1,
  full_sun: 2,
};

const LABEL: Record<StudioLightReq, string> = {
  full_sun: "the brightest edge",
  partial_shade: "a filtered-light area",
  shade: "a shaded area",
};

function normalizePreference(value: string | null | undefined) {
  return normalizeKey(value)
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ");
}

function sunlightTarget(preference: string | null | undefined): StudioLightReq | null {
  const pref = normalizePreference(preference);
  if (!pref) return null;
  if (pref.includes("full sun") || (pref.includes("direct") && !pref.includes("indirect"))) return "full_sun";
  if (pref.includes("bright") || pref.includes("indirect") || pref.includes("partial")) return "partial_shade";
  if (pref.includes("shade") || pref.includes("low light")) return "shade";
  return null;
}

function matchesSoilPreference(
  preference: string | null | undefined,
  soilType: string | null | undefined,
  substrateMix: StudioContextPlant["pot_profile"]["substrate_mix"] | null | undefined,
) {
  const pref = normalizePreference(preference);
  const soil = normalizePreference(soilType);
  const mix = normalizePreference(substrateMix);
  if (!pref || (!soil && !mix)) return { score: null, note: "Soil fit not assessed: requirement or setup is missing" };

  const goodDrainage = soil.includes("sandy") || soil.includes("loamy") || soil.includes("potting mix") || mix === "balanced" || mix === "high mineral";
  const richSoil = soil.includes("potting mix") || mix === "high organic" || soil.includes("loamy");
  const drySoil = soil.includes("sandy") || mix === "high mineral";

  if ((pref.includes("drain") || pref.includes("airy") || pref.includes("well") || pref.includes("fast")) && goodDrainage) {
    return { score: 1, note: "Configured soil matches the recorded drainage preference" };
  }
  if ((pref.includes("organic") || pref.includes("moist") || pref.includes("rich")) && richSoil) {
    return { score: 1, note: "Soil matches a richer mix" };
  }
  if ((pref.includes("dry") || pref.includes("succulent") || pref.includes("cactus")) && drySoil) {
    return { score: 1, note: "Soil is dry and fast draining" };
  }
  if (pref.includes("drain") && soil.includes("clay")) {
    return { score: 0.4, note: "Soil may hold too much water" };
  }
  return { score: null, note: `Soil fit needs manual review against: ${pref}` };
}

function matchWateringRange(
  wateringDaysMin: number | null | undefined,
  wateringDaysMax: number | null | undefined,
  waterDays: number,
) {
  if (
    wateringDaysMin == null ||
    wateringDaysMax == null ||
    !Number.isFinite(wateringDaysMin) ||
    !Number.isFinite(wateringDaysMax) ||
    !Number.isFinite(waterDays)
  ) {
    return { score: null, note: "Watering fit not assessed: species range is unavailable" };
  }
  const min = Math.min(wateringDaysMin, wateringDaysMax);
  const max = Math.max(wateringDaysMin, wateringDaysMax);
  if (waterDays >= min && waterDays <= max) {
    return { score: 1, note: `Watering falls inside the ${min}-${max} day range` };
  }
  const diff = waterDays < min ? min - waterDays : waterDays - max;
  if (diff === 1) {
    return { score: 0.8, note: "Watering is slightly off range" };
  }
  if (diff === 2) {
    return { score: 0.62, note: "Watering is outside the comfort band" };
  }
  return { score: 0.45, note: `Watering sits outside the ${min}-${max} day range` };
}

function studioZoneAt(z: number, gardenType: StudioGardenType): StudioLightReq {
  const halfD: Record<StudioGardenType, number> = {
    balcony: 1.2,
    terrace: 2.0,
    indoor: 2.2,
    backyard: 3.2,
  };
  const hd = halfD[gardenType];
  const fullFrac = 1 / 3;
  const partialFrac = 2 / 3;
  const fromLightSide = gardenType === "indoor"
    ? (hd + z) / (hd * 2)
    : (hd - z) / (hd * 2);

  if (fromLightSide <= fullFrac) return "full_sun";
  if (fromLightSide <= partialFrac) return "partial_shade";
  return "shade";
}

function normalizeKey(value: string | null | undefined) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function usableKnowledge(value: PlantKnowledge | null | undefined): PlantKnowledge | null {
  if (!value || value.confidence === "low" || value.source === "unknown") return null;
  return value;
}

function distance(a: StudioPlant, b: StudioPlant) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function nearestPlant(plant: StudioPlant, plants: StudioPlant[]) {
  return plants
    .filter((other) => other.id !== plant.id)
    .map((other) => ({ plant: other, distance: distance(plant, other) }))
    .sort((a, b) => a.distance - b.distance)[0] ?? null;
}

function currentZone(plant: StudioPlant, gardenType: StudioGardenType) {
  return studioZoneAt(plant.z, gardenType);
}

function preferredZoneLabel(zone: StudioLightReq) {
  return LABEL[zone];
}

function companionMatch(
  plant: StudioPlant,
  other: StudioPlant,
  knowledge?: PlantKnowledge | null,
  otherKnowledge?: PlantKnowledge | null,
) {
  const leftNames = new Set([normalizeKey(plant.species), normalizeKey(plant.commonName)].filter(Boolean));
  const rightNames = new Set([normalizeKey(other.species), normalizeKey(other.commonName)].filter(Boolean));
  const leftLikesRight = (knowledge?.companion_plants ?? [])
    .some((entry) => rightNames.has(normalizeKey(entry)));
  const rightLikesLeft = (otherKnowledge?.companion_plants ?? [])
    .some((entry) => leftNames.has(normalizeKey(entry)));

  return leftLikesRight || rightLikesLeft;
}

function buildPlantEvidence(
  plant: StudioPlant,
  actualZone: StudioLightReq,
  contextPlant: StudioContextPlant | null | undefined,
  knowledge: PlantKnowledge | null | undefined,
  gardenType: StudioGardenType,
) {
  const evidence: string[] = [
    `Current position: ${preferredZoneLabel(actualZone)}.`,
    `Selected light target: ${preferredZoneLabel(plant.lightReq)}.`,
    `Space: ${getGardenTypeProfile(gardenType).label}.`,
  ];

  if (knowledge?.sunlight_preference) {
    evidence.push(`Plant guidance: ${knowledge.sunlight_preference}.`);
  }
  if (knowledge?.soil_preference) {
    evidence.push(`Soil guidance: ${knowledge.soil_preference}.`);
  }
  if (knowledge?.watering_baseline) {
    evidence.push(`Watering guidance: ${knowledge.watering_baseline}.`);
  }
  if (contextPlant) {
    if (contextPlant.soil.user_confirmed) {
      evidence.push(`Your soil: ${contextPlant.soil.type} (${contextPlant.soil.drainage} drainage).`);
    } else {
      evidence.push("Soil was not confirmed, so it was not used in the check.");
    }
    if (contextPlant.studio_zone) {
      evidence.push(`Saved light target: ${preferredZoneLabel(contextPlant.studio_zone)}.`);
    }
  }

  return evidence;
}

export function buildStudioAdvice(input: {
  gardenType: StudioGardenType;
  plants: StudioPlant[];
  knowledgeBySpecies?: Record<string, PlantKnowledge | null | undefined>;
  contextPlants?: StudioContextPlant[];
}): StudioAdviceResult {
  const gardenType = input.gardenType;
  const plants = input.plants;
  const contextBySpecies = new Map<string, StudioContextPlant>();
  const contextByCommonName = new Map<string, StudioContextPlant>();
  const contextPlants = input.contextPlants ?? [];
  for (const plant of contextPlants) {
    const speciesKey = normalizeKey(plant.species);
    const commonKey = normalizeKey(plant.common_name);
    if (speciesKey) contextBySpecies.set(speciesKey, plant);
    if (commonKey) contextByCommonName.set(commonKey, plant);
  }
  const contextFor = (plant: StudioPlant) =>
    contextBySpecies.get(normalizeKey(plant.species))
    ?? contextByCommonName.get(normalizeKey(plant.commonName))
    ?? null;

  const suggestions: StudioSuggestion[] = [];
  const plantInsights: StudioPlantInsight[] = [];
  let alignedPlants = 0;
  let needsMove = 0;
  let speciesEvidencePlants = 0;

  for (const plant of plants) {
    const actual = currentZone(plant, gardenType);
    const plantKey = normalizeKey(plant.species);
    const contextPlant = contextFor(plant);
    const knowledge = usableKnowledge(input.knowledgeBySpecies?.[plantKey] ?? contextPlant?.plant_knowledge ?? null);
    const evidenceTarget = sunlightTarget(knowledge?.sunlight_preference);
    // The user's configured target is authoritative. Species knowledge is used
    // as a check, not as a silent override of an explicit garden choice.
    const target = plant.lightReq;
    if (evidenceTarget) speciesEvidencePlants += 1;
    const gap = Math.abs(LEVEL[actual] - LEVEL[target]);
    const direction = LEVEL[target] > LEVEL[actual] ? "forward" : LEVEL[target] < LEVEL[actual] ? "backward" : "group";
    const soilFit = matchesSoilPreference(
      knowledge?.soil_preference,
      contextPlant?.soil.user_confirmed ? contextPlant.soil.type : null,
      contextPlant?.soil.user_confirmed ? contextPlant.pot_profile.substrate_mix : null,
    );
    const wateringFit = matchWateringRange(
      knowledge?.watering_days_min ?? null,
      knowledge?.watering_days_max ?? null,
      plant.waterDays,
    );
    const fitScore = gap === 0 ? 100 : gap === 1 ? 60 : 25;
    const evidence = buildPlantEvidence(
      plant,
      actual,
      contextPlant,
      knowledge,
      gardenType,
    );
    const nearest = nearestPlant(plant, plants);
    if (nearest) {
      evidence.push(`Nearest plant: ${nearest.plant.commonName} at ${nearest.distance.toFixed(2)}m.`);
      evidence.push("Spacing is shown as a physical gap only; mature-size spacing needs species-specific data.");
    }
    evidence.push(evidenceTarget
      ? `Species sunlight record: ${knowledge?.sunlight_preference}.`
      : "No mapped species sunlight record; placement uses the selected light target.");
    if (soilFit.score !== null) evidence.push(`Soil check: ${soilFit.note}.`);
    if (wateringFit.score !== null) evidence.push(`Watering check: ${wateringFit.note}.`);
    const severity: StudioSuggestionSeverity = gap === 0 ? "good" : gap === 1 ? "warning" : "critical";

    if (soilFit.score !== null && soilFit.score < 0.6) {
      suggestions.push({
        id: `soil-${plant.id}`,
        kind: "setup",
        severity: "warning",
        plantIds: [plant.id],
        plantNames: [plant.commonName],
        title: `Review soil for ${plant.commonName}`,
        detail: soilFit.note,
        evidence: [
          `Species soil preference: ${knowledge?.soil_preference}.`,
          `User-confirmed soil: ${contextPlant?.soil.type}.`,
        ],
        score: 0.7,
      });
    }
    if (evidenceTarget && evidenceTarget !== plant.lightReq) {
      suggestions.push({
        id: `light-target-${plant.id}`,
        kind: "setup",
        severity: "warning",
        plantIds: [plant.id],
        plantNames: [plant.commonName],
        title: `Check the light target for ${plant.commonName}`,
        detail: `Your layout is set to ${preferredZoneLabel(plant.lightReq)}, while the species record indicates ${preferredZoneLabel(evidenceTarget)}. Confirm which target fits this plant before moving it.`,
        evidence: [
          `Your selected target: ${preferredZoneLabel(plant.lightReq)}.`,
          `Species record: ${knowledge?.sunlight_preference}.`,
        ],
        targetZone: evidenceTarget,
        direction: "group",
        score: 0.84,
      });
    }
    if (wateringFit.score !== null && wateringFit.score < 0.6) {
      suggestions.push({
        id: `water-${plant.id}`,
        kind: "setup",
        severity: "warning",
        plantIds: [plant.id],
        plantNames: [plant.commonName],
        title: `Review watering for ${plant.commonName}`,
        detail: wateringFit.note,
        evidence: [
          `Configured interval: ${plant.waterDays} days.`,
          `Species range: ${knowledge?.watering_days_min}-${knowledge?.watering_days_max} days.`,
        ],
        score: 0.72,
      });
    }

    if (gap === 0) {
      alignedPlants += 1;
      plantInsights.push({
        plantId: plant.id,
        plantName: plant.commonName,
        currentZone: actual,
        targetZone: target,
        fitScore,
        severity,
        direction,
        summary: `Position matches the ${LABEL[target]} planning band.`,
        evidence: evidence.slice(0, 3),
        nearestPlantName: nearest?.plant.commonName,
        nearestDistanceMeters: nearest?.distance,
      });
      suggestions.push({
        id: `plant-${plant.id}`,
        kind: "placement",
        severity: "good",
        plantIds: [plant.id],
        plantNames: [plant.commonName],
        title: `${plant.commonName} is well placed`,
        detail: `Its canvas position matches ${evidenceTarget ? "the species-derived" : "the selected"} light target. This is a planning result, not measured sunlight.`,
        evidence,
        targetZone: actual,
        direction,
        score: 0.95,
      });
      continue;
    }

    needsMove += 1;
    plantInsights.push({
      plantId: plant.id,
      plantName: plant.commonName,
      currentZone: actual,
      targetZone: target,
      fitScore,
      severity: gap >= 2 ? "critical" : "warning",
      direction,
      summary:
        gap >= 2
          ? `Move into the ${preferredZoneLabel(target)} planning band.`
          : `Shift into the ${preferredZoneLabel(target)} planning band.`,
      evidence: evidence.slice(0, 3),
      nearestPlantName: nearest?.plant.commonName,
      nearestDistanceMeters: nearest?.distance,
    });
    suggestions.push({
      id: `plant-${plant.id}`,
      kind: "placement",
      severity: gap >= 2 ? "critical" : "warning",
      plantIds: [plant.id],
      plantNames: [plant.commonName],
      title: `Move ${plant.commonName} to ${preferredZoneLabel(target)}`,
      detail: `Move it toward ${direction === "forward" ? "the brighter area" : "the shaded area"}. Confirm real exposure with observed direct-sun hours before changing care.`,
      evidence,
      targetZone: target,
      direction,
      score: fitScore / 100,
    });
  }

  let companionLinks = 0;
  for (let i = 0; i < plants.length; i += 1) {
    for (let j = i + 1; j < plants.length; j += 1) {
      const left = plants[i];
      const right = plants[j];
      const dist = distance(left, right);
      const leftContext = contextFor(left);
      const rightContext = contextFor(right);
      const leftKnowledge = usableKnowledge(input.knowledgeBySpecies?.[normalizeKey(left.species)] ?? leftContext?.plant_knowledge ?? null);
      const rightKnowledge = usableKnowledge(input.knowledgeBySpecies?.[normalizeKey(right.species)] ?? rightContext?.plant_knowledge ?? null);
      const areCompanions = companionMatch(left, right, leftKnowledge, rightKnowledge);

      if (areCompanions) {
        companionLinks += 1;
        suggestions.push({
          id: `pair-${left.id}-${right.id}`,
          kind: "companion",
          severity: "good",
          plantIds: [left.id, right.id],
          plantNames: [left.commonName, right.commonName],
          title: `Recorded companion link: ${left.commonName} + ${right.commonName}`,
          detail: "Species reference data lists this relationship. Confirm mature size, container space, and local growing guidance before grouping them physically.",
          evidence: [
            `Companion plants matched through species knowledge.`,
            `Canvas distance is ${dist.toFixed(2)}m; this is not a biological spacing recommendation.`,
          ],
          direction: "group",
          score: 0.9,
        });
        continue;
      }

    }
  }

  const overallNote =
    needsMove === 0
      ? "Canvas positions match the selected light targets. Verify the bands against observed sun before applying them to care."
      : "Some plants are away from their selected light targets. These bands are planning aids, not measured exposure.";

  return {
    summary: {
      totalPlants: plants.length,
      alignedPlants,
      needsMove,
      companionLinks,
      speciesEvidencePlants,
      configuredOnlyPlants: plants.length - speciesEvidencePlants,
      overallNote,
    },
    plantInsights: plantInsights.sort((a, b) => a.fitScore - b.fitScore),
    suggestions: suggestions.sort((a, b) => b.score - a.score),
  };
}
