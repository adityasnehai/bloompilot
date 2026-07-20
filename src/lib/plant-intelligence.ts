import { requestOpenAIJson } from "@/lib/openai";
import { normalizePlacement, type PlantPlacement, type SunlightLevel } from "@/lib/garden";

type PlantProfileSuggestion = {
  nickname: string;
  placement: PlantPlacement;
  sunlight: SunlightLevel;
  wateringIntervalDays: number;
  notes: string;
};

function normalizeSunlight(value: string): SunlightLevel {
  if (
    value === "Low light" ||
    value === "Bright indirect" ||
    value === "Partial sun" ||
    value === "Full sun"
  ) {
    return value;
  }

  return "Bright indirect";
}

function normalizeText(value: string) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/(^|\s)\S/g, (char) => char.toUpperCase());
}

export async function suggestSpeciesFromPlantName(input: {
  plantName: string;
  location: string;
  gardenType: string;
}) {
  const name = normalizeText(input.plantName);

  if (!name) {
    return "";
  }

  try {
    const response = await requestOpenAIJson<{ species?: string }>({
      prompt: `
Infer likely plant species from user-provided plant name.

Input:
- plant name: ${name}
- location: ${input.location}
- garden type: ${input.gardenType}

Return JSON:
{ "species": string }

Rules:
- Return a short scientific or common species identifier.
- If uncertain, return an empty string.
      `.trim(),
      maxOutputTokens: 120,
    });

    const species = response.species?.trim() ?? "";
    return species.toLowerCase().includes("unknown") ? "" : species;
  } catch {
    return "";
  }
}

export async function generatePlantProfileSuggestion(input: {
  species: string;
  commonName?: string;
  gardenType: string;
  location: string;
}) {
  const fallback: PlantProfileSuggestion = {
    nickname: input.commonName || input.species.split(" ")[0] || "New plant",
    placement: normalizePlacement(input.gardenType),
    sunlight: "Bright indirect",
    wateringIntervalDays: 5,
    notes: `Detected from a plant photo in ${input.location}.`,
  };

  try {
    const suggestion = await requestOpenAIJson<PlantProfileSuggestion>({
      prompt: `
You are generating a conservative initial care profile for a gardening SaaS app.

Plant:
- species: ${input.species}
- common name: ${input.commonName ?? "unknown"}
- garden type: ${input.gardenType}
- location: ${input.location}

Return JSON only with this exact shape:
{
  "nickname": string,
  "placement": "Indoor collection" | "Balcony garden" | "Backyard garden" | "Terrace garden",
  "sunlight": "Low light" | "Bright indirect" | "Partial sun" | "Full sun",
  "wateringIntervalDays": integer,
  "notes": string
}

Rules:
- keep wateringIntervalDays between 2 and 10
- prefer conservative, beginner-safe advice
- nickname should be short and friendly
- notes should be one short sentence
      `.trim(),
      maxOutputTokens: 250,
    });

    return {
      nickname: suggestion.nickname?.trim() || fallback.nickname,
      placement: normalizePlacement(suggestion.placement),
      sunlight: normalizeSunlight(suggestion.sunlight),
      wateringIntervalDays: Math.max(
        2,
        Math.min(
          10,
          Math.round(Number(suggestion.wateringIntervalDays) || fallback.wateringIntervalDays),
        ),
      ),
      notes: suggestion.notes?.trim() || fallback.notes,
    } satisfies PlantProfileSuggestion;
  } catch {
    return fallback;
  }
}
