import { requestOpenAIJson } from "@/lib/openai";
import { appConfig } from "@/lib/app-config";

export type PlantIdentification = {
  scientificName: string;
  commonName?: string;
  confidence: number;
  displayName: string;
};

export type PlantDetectionCandidate = {
  commonName: string;
  scientificName: string;
  confidence: number;
  displayName: string;
};

type PlantNetResponse = {
  results?: Array<{
    score?: number;
    species?: {
      scientificNameWithoutAuthor?: string;
      commonNames?: string[];
    };
  }>;
};

function requirePlantNetKey() {
  const key = process.env.PLANTNET_API_KEY?.trim();

  if (!key) {
    throw new Error("PLANTNET_API_KEY is missing");
  }

  return key;
}

function isKnownPlantName(value?: string | null) {
  const normalized = value?.trim().toLowerCase() ?? "";
  return Boolean(normalized && normalized !== "unknown plant" && normalized !== "unknown");
}

async function identifyWithOpenAI(photo: File) {
  const bytes = new Uint8Array(await photo.arrayBuffer());

  try {
    const result = await requestOpenAIJson<{
      scientificName?: string;
      commonName?: string;
      confidence?: number;
    }>({
      prompt: `
Identify the plant in this image for a beginner gardening app.

Return JSON only:
{
  "scientificName": string,
  "commonName": string,
  "confidence": integer
}

Rules:
- If unsure, return an empty string for scientificName.
- commonName should be short and user-friendly.
- confidence must be 0-100.
      `.trim(),
      image: {
        bytes,
        mimeType: photo.type || "image/jpeg",
      },
      maxOutputTokens: 220,
    });

    const scientificName = result.scientificName?.trim() || "";
    const commonName = result.commonName?.trim();
    const confidence = Math.max(
      0,
      Math.min(100, Math.round(Number(result.confidence) || 0)),
    );

    return {
      scientificName,
      commonName,
      confidence,
      displayName:
        commonName && scientificName !== commonName
          ? `${commonName} (${scientificName})`
          : scientificName,
    } satisfies PlantIdentification;
  } catch {
    return {
      scientificName: "",
      commonName: "Photo plant",
      confidence: 0,
      displayName: "Photo plant",
    } satisfies PlantIdentification;
  }
}

async function identifyWithPlantNet(photo: File) {
  const formData = new FormData();
  formData.append("images", photo);
  formData.append("organs", "leaf");

  const url = new URL("https://my-api.plantnet.org/v2/identify/all");
  url.searchParams.set("api-key", requirePlantNetKey());
  url.searchParams.set("lang", "en");
  url.searchParams.set("include-related-images", "false");

  const response = await fetch(url, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Plant identification failed: ${response.status} ${detail}`);
  }

  const payload = (await response.json()) as PlantNetResponse;
  const best = payload.results?.[0];
  const scientificName = best?.species?.scientificNameWithoutAuthor?.trim();

  if (!scientificName) {
    throw new Error("Plant identification returned no species");
  }

  const commonName = best?.species?.commonNames?.find(Boolean)?.trim();
  const displayName = commonName
    ? `${commonName} (${scientificName})`
    : scientificName;

  return {
    scientificName,
    commonName,
    confidence: Math.round((best?.score ?? 0) * 100),
    displayName,
  } satisfies PlantIdentification;
}

async function identifyCandidatesWithPlantNet(photo: File) {
  const formData = new FormData();
  formData.append("images", photo);
  formData.append("organs", "leaf");

  const url = new URL("https://my-api.plantnet.org/v2/identify/all");
  url.searchParams.set("api-key", requirePlantNetKey());
  url.searchParams.set("lang", "en");
  url.searchParams.set("include-related-images", "false");

  const response = await fetch(url, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Plant identification failed: ${response.status}`);
  }

  const payload = (await response.json()) as PlantNetResponse;
  const results = payload.results ?? [];

  return results
    .map((item) => {
      const scientificName = item.species?.scientificNameWithoutAuthor?.trim() || "";
      const commonName = item.species?.commonNames?.find(Boolean)?.trim() || scientificName;

      return {
        commonName,
        scientificName,
        confidence: Math.max(0, Math.min(100, Math.round((item.score ?? 0) * 100))),
        displayName:
          commonName && commonName !== scientificName
            ? `${commonName} (${scientificName})`
            : scientificName,
      } satisfies PlantDetectionCandidate;
    })
    .filter((candidate) => isKnownPlantName(candidate.scientificName))
    .slice(0, 3);
}

export async function identifyPlantPhoto(photo: File) {
  try {
    return await identifyWithPlantNet(photo);
  } catch {
    if (appConfig.strictProductionMode) {
      return {
        scientificName: "",
        commonName: "Photo plant",
        confidence: 0,
        displayName: "Photo plant",
      } satisfies PlantIdentification;
    }
    return identifyWithOpenAI(photo);
  }
}

export async function identifyPlantPhotoCandidates(photo: File) {
  try {
    const candidates = await identifyCandidatesWithPlantNet(photo);
    if (candidates.length > 0) {
      return candidates;
    }
  } catch {
    // fallback below
  }

  const fallback = await identifyPlantPhoto(photo);
  if (!isKnownPlantName(fallback.scientificName)) {
    return [];
  }

  return [
    {
      commonName: fallback.commonName || fallback.scientificName,
      scientificName: fallback.scientificName,
      confidence: fallback.confidence,
      displayName: fallback.displayName,
    },
  ];
}
