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

export type GardenTypeChoice = {
  value: GardenTypeProfile["value"];
  label: GardenTypeProfile["label"];
  description: GardenTypeProfile["description"];
  imagePath: GardenTypeProfile["imagePath"];
};

export const GARDEN_TYPES: GardenTypeProfile[] = [
  {
    value: "Indoor",
    label: "Indoor collection",
    description: "Plants live inside the home. Window light, humidity, and indoor airflow matter more than rain or wind.",
    imagePath: "/garden-types/indoor.avif",
    exposure: "none",
    weatherAffected: false,
    frostRelevant: false,
    windRelevant: false,
    rainRelevant: false,
    uvExposed: false,
    rootSpace: "limited",
    wateringModifier: 0.85,
    plannerNote: "Indoor garden: outdoor weather is mostly irrelevant. Light is filtered through glass, humidity tends to be lower, and soil dries more slowly than outside. Focus on bright indirect light, airflow, and overwatering risk.",
  },
  {
    value: "Balcony",
    label: "Balcony garden",
    description: "Plants sit on a balcony or ledge in containers. Wind, reflected heat, and fast-drying pots matter more than ground soil.",
    imagePath: "/garden-types/balcony.jpg",
    exposure: "partial",
    weatherAffected: true,
    frostRelevant: true,
    windRelevant: true,
    rainRelevant: true,
    uvExposed: true,
    rootSpace: "limited",
    wateringModifier: 1.0,
    plannerNote: "Balcony garden: partial weather exposure. Walls block some wind, but reflected heat and container drying are still important. Frost, heavy rain, and wind gusts remain relevant.",
  },
  {
    value: "Backyard",
    label: "Backyard garden",
    description: "Plants grow in open beds or ground soil. Roots get more buffering from the soil than in containers, but weather still matters.",
    imagePath: "/garden-types/backyard.jpg",
    exposure: "full",
    weatherAffected: true,
    frostRelevant: true,
    windRelevant: true,
    rainRelevant: true,
    uvExposed: true,
    rootSpace: "unlimited",
    wateringModifier: 1.1,
    plannerNote: "Backyard garden: full weather exposure. Ground beds retain moisture longer than pots, so irrigation is usually steadier. Heat, frost, rain, and wind all matter.",
  },
  {
    value: "Terrace",
    label: "Terrace garden",
    description: "Plants sit high up on a terrace or rooftop. Sun, wind, and evaporation are strongest here, so containers dry quickly.",
    imagePath: "/garden-types/rooftop.jpg",
    exposure: "elevated",
    weatherAffected: true,
    frostRelevant: true,
    windRelevant: true,
    rainRelevant: true,
    uvExposed: true,
    rootSpace: "limited",
    wateringModifier: 1.3,
    plannerNote: "Terrace garden: maximum exposure. Elevated rooftops get stronger wind, more UV, and faster evaporation. Windbreaks, shade cloth, and frequent moisture checks are often needed.",
  },
];

export const GARDEN_TYPE_CHOICES: GardenTypeChoice[] = [
  {
    value: "Indoor",
    label: "Indoor collection",
    description: "Inside, with filtered light and slower-drying soil.",
    imagePath: GARDEN_TYPES[0].imagePath,
  },
  {
    value: "Balcony",
    label: "Balcony garden",
    description: "Containers exposed to wind, sun, and rain.",
    imagePath: GARDEN_TYPES[1].imagePath,
  },
  {
    value: "Backyard",
    label: "Backyard garden",
    description: "Open beds with deeper soil and full weather.",
    imagePath: GARDEN_TYPES[2].imagePath,
  },
  {
    value: "Terrace",
    label: "Terrace garden",
    description: "Rooftop containers with strong sun and wind.",
    imagePath: GARDEN_TYPES[3].imagePath,
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
  "Terrace garden": "Terrace",
  "terrace garden": "Terrace",
  "terrace": "Terrace",
  "rooftop": "Terrace",
  "Patio or container garden": "Balcony",
  "patio or container garden": "Balcony",
  "patio": "Balcony",
  "container garden": "Balcony",
  "Container / Patio": "Balcony",
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
