/**
 * Garden type profiles — every care decision that depends on weather exposure
 * routes through here. Indoor gardens don't get frost warnings; rooftops get
 * extra wind/UV multipliers, etc.
 */

export type GardenExposure = "none" | "partial" | "full" | "elevated";

export type GardenTypeProfile = {
  /** Canonical stored value */
  value: string;
  /** Display label */
  label: string;
  /** Short description for UI */
  description: string;
  /** SVG image path */
  imagePath: string;
  /** Weather exposure level */
  exposure: GardenExposure;
  /** Whether outdoor weather (rain, wind, frost) is relevant at all */
  weatherAffected: boolean;
  /** Frost risk is applicable */
  frostRelevant: boolean;
  /** Wind stress is applicable */
  windRelevant: boolean;
  /** Rain skip watering is applicable */
  rainRelevant: boolean;
  /** Full solar UV reaches plants */
  uvExposed: boolean;
  /** Root space */
  rootSpace: "limited" | "unlimited";
  /**
   * Multiplier on base watering interval.
   * > 1 means dries faster → water more often.
   * < 1 means retains moisture → water less often.
   */
  wateringModifier: number;
  /** Contextual note shown to the AI planner */
  plannerNote: string;
};

export const GARDEN_TYPES: GardenTypeProfile[] = [
  {
    value: "Indoor",
    label: "Indoor",
    description: "Plants inside the home near windows and shelves.",
    imagePath: "/garden-types/indoor-collection.svg",
    exposure: "none",
    weatherAffected: false,
    frostRelevant: false,
    windRelevant: false,
    rainRelevant: false,
    uvExposed: false,
    rootSpace: "limited",
    wateringModifier: 0.85,
    plannerNote: "Indoor garden: outdoor weather (frost, wind, rain) is irrelevant. Light comes through glass so UV is filtered. Soil dries slower than outdoor. Focus on light quality, humidity, and overwatering risk.",
  },
  {
    value: "Balcony",
    label: "Balcony",
    description: "Small outdoor setup with rail planters and compact pots.",
    imagePath: "/garden-types/balcony-garden.svg",
    exposure: "partial",
    weatherAffected: true,
    frostRelevant: true,
    windRelevant: true,
    rainRelevant: true,
    uvExposed: true,
    rootSpace: "limited",
    wateringModifier: 1.0,
    plannerNote: "Balcony garden: partial weather exposure. Walls block some wind. Pots dry out faster than ground. Frost and heavy rain are relevant.",
  },
  {
    value: "Backyard",
    label: "Backyard",
    description: "Larger outdoor growing space with beds or open ground.",
    imagePath: "/garden-types/backyard-garden.svg",
    exposure: "full",
    weatherAffected: true,
    frostRelevant: true,
    windRelevant: true,
    rainRelevant: true,
    uvExposed: true,
    rootSpace: "unlimited",
    wateringModifier: 1.1,
    plannerNote: "Backyard garden: full weather exposure. Ground beds retain more moisture than pots. All weather risks apply.",
  },
  {
    value: "Terrace",
    label: "Terrace",
    description: "Open rooftop or terrace exposed to sun and wind.",
    imagePath: "/garden-types/terrace-rooftop-garden.svg",
    exposure: "elevated",
    weatherAffected: true,
    frostRelevant: true,
    windRelevant: true,
    rainRelevant: true,
    uvExposed: true,
    rootSpace: "limited",
    wateringModifier: 1.3,
    plannerNote: "Terrace/rooftop garden: maximum weather exposure. Elevated position means stronger wind and UV. Pots dry out very fast. Windbreaks and shade cloth often needed.",
  },
  {
    value: "Container Garden",
    label: "Container Garden",
    description: "Movable pots and containers on a patio or hard surface.",
    imagePath: "/garden-types/patio-container-garden.svg",
    exposure: "partial",
    weatherAffected: true,
    frostRelevant: true,
    windRelevant: false,
    rainRelevant: true,
    uvExposed: true,
    rootSpace: "limited",
    wateringModifier: 1.05,
    plannerNote: "Container garden: pots outdoors, movable. Wind exposure is low (ground level, sheltered). Rain and frost still relevant. Containers drain freely so watch for drying out.",
  },
];

/** Maps old stored values + aliases to the canonical profile */
const VALUE_ALIASES: Record<string, string> = {
  // old → new canonical
  "Indoor collection": "Indoor",
  "indoor collection": "Indoor",
  "indoor": "Indoor",
  "Balcony garden": "Balcony",
  "balcony garden": "Balcony",
  "balcony": "Balcony",
  "Backyard garden": "Backyard",
  "backyard garden": "Backyard",
  "backyard": "Backyard",
  "Terrace or rooftop garden": "Terrace",
  "terrace or rooftop garden": "Terrace",
  "terrace": "Terrace",
  "rooftop": "Terrace",
  "Patio or container garden": "Container Garden",
  "patio or container garden": "Container Garden",
  "patio": "Container Garden",
  "container garden": "Container Garden",
  "Container / Patio": "Container Garden",
};

const profileMap = new Map<string, GardenTypeProfile>(
  GARDEN_TYPES.map((p) => [p.value, p]),
);

export function getGardenTypeProfile(value: string | null | undefined): GardenTypeProfile {
  if (!value) return GARDEN_TYPES[0];
  const canonical = VALUE_ALIASES[value] ?? value;
  return profileMap.get(canonical) ?? GARDEN_TYPES[0];
}

export function normalizeGardenTypeValue(value: string | null | undefined): string {
  return getGardenTypeProfile(value).value;
}
