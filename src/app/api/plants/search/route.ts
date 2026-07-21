import { NextResponse } from "next/server";
import { withApiHandler, clientIp, rateLimitedResponse } from "@/lib/api-handler";
import { checkRateLimit } from "@/lib/rate-limit";

type PlantSuggestion = {
  commonName: string;
  species: string;
  imageUrl?: string;
  observationsCount?: number;
  family?: string;
};

type INaturalistTaxon = {
  preferred_common_name?: string;
  name?: string;
  matched_term?: string;
  rank?: string;
  iconic_taxon_name?: string;
  observations_count?: number;
  default_photo?: {
    medium_url?: string;
    square_url?: string;
    url?: string;
  };
};

type INaturalistAutocompleteResponse = {
  results?: INaturalistTaxon[];
};

type GbifSearchItem = {
  canonicalName?: string;
  scientificName?: string;
  vernacularNames?: string[];
  rank?: string;
  kingdom?: string;
  status?: string;
  numOccurrences?: number;
};

type GbifSearchResponse = {
  results?: GbifSearchItem[];
};

const iNatCache = new Map<string, PlantSuggestion[]>();
const gbifCache = new Map<string, PlantSuggestion[]>();

function uniqueSuggestions(items: PlantSuggestion[]) {
  const seen = new Set<string>();
  const unique: PlantSuggestion[] = [];

  for (const item of items) {
    const key = `${item.commonName.toLowerCase()}::${item.species.toLowerCase()}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(item);
  }

  return unique;
}

function scoreSuggestion(item: INaturalistTaxon, query: string) {
  const q = query.toLowerCase();
  const common = (item.preferred_common_name ?? "").toLowerCase();
  const species = (item.name ?? "").toLowerCase();
  const matched = (item.matched_term ?? "").toLowerCase();
  const obs = Number(item.observations_count ?? 0);
  const textMatch =
    common.startsWith(q) ||
    common.includes(q) ||
    matched.startsWith(q) ||
    matched.includes(q) ||
    species.startsWith(q) ||
    species.includes(q);

  if (!textMatch) {
    return 0;
  }

  let score = 0;
  if (common.startsWith(q)) score += 120;
  if (matched.startsWith(q)) score += 100;
  if (common.includes(q)) score += 80;
  if (matched.includes(q)) score += 75;
  if (species.startsWith(q)) score += 40;
  if (species.includes(q)) score += 20;
  if (item.rank === "species") score += 35;
  score += Math.min(40, Math.log10(obs + 1) * 8);

  return score;
}

async function suggestPlantsWithINaturalist(query: string) {
  if (iNatCache.has(query)) {
    return iNatCache.get(query) ?? [];
  }

  try {
    const url = new URL("https://api.inaturalist.org/v1/taxa/autocomplete");
    url.searchParams.set("q", query);
    url.searchParams.set("taxon_id", "47126"); // Plantae
    url.searchParams.set("is_active", "true");
    url.searchParams.set("per_page", "20");

    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`iNaturalist request failed with ${response.status}`);
    }

    const payload = (await response.json()) as INaturalistAutocompleteResponse;
    const suggestions = (payload.results ?? [])
      .filter((item) => (item.iconic_taxon_name ?? "").toLowerCase() === "plantae")
      .filter((item) => Boolean(item.preferred_common_name || item.name))
      .filter((item) => scoreSuggestion(item, query) > 0)
      .sort((left, right) => scoreSuggestion(right, query) - scoreSuggestion(left, query))
      .map((item) => ({
        commonName: item.preferred_common_name?.trim() || item.name?.trim() || "",
        species: item.name?.trim() || "",
        imageUrl:
          item.default_photo?.medium_url?.trim() ||
          item.default_photo?.square_url?.trim() ||
          item.default_photo?.url?.trim() ||
          undefined,
        observationsCount: item.observations_count ?? 0,
        family: item.iconic_taxon_name ?? undefined,
      }))
      .filter((item) => item.commonName.length > 0 && item.species.length > 0)
      .slice(0, 8);

    iNatCache.set(query, suggestions);
    return suggestions;
  } catch {
    return [];
  }
}

function pickGbifCommonName(item: GbifSearchItem, query: string) {
  const q = query.toLowerCase();
  const names = item.vernacularNames ?? [];
  const matchingName = names.find((name) => name.toLowerCase().includes(q));
  return matchingName ?? names[0] ?? item.canonicalName ?? item.scientificName ?? "";
}

function scoreGbifSuggestion(item: GbifSearchItem, query: string) {
  const q = query.toLowerCase();
  const common = (item.vernacularNames ?? []).join(" ").toLowerCase();
  const canonical = (item.canonicalName ?? "").toLowerCase();
  const scientific = (item.scientificName ?? "").toLowerCase();
  const textMatch =
    common.includes(q) ||
    canonical.includes(q) ||
    scientific.includes(q);

  if (!textMatch) return 0;

  let score = 0;
  if (common.split(" ").some((name) => name.startsWith(q))) score += 100;
  if (common.includes(q)) score += 75;
  if (canonical.startsWith(q)) score += 45;
  if (scientific.startsWith(q)) score += 35;
  if (item.rank === "SPECIES") score += 25;
  if (item.status === "ACCEPTED") score += 15;
  score += Math.min(30, Math.log10((item.numOccurrences ?? 0) + 1) * 6);
  return score;
}

async function suggestPlantsWithGbif(query: string) {
  if (gbifCache.has(query)) {
    return gbifCache.get(query) ?? [];
  }

  try {
    const url = new URL("https://api.gbif.org/v1/species/search");
    url.searchParams.set("q", query);
    url.searchParams.set("rank", "SPECIES");
    url.searchParams.set("status", "ACCEPTED");
    url.searchParams.set("kingdom", "Plantae");
    url.searchParams.set("limit", "12");

    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`GBIF request failed with ${response.status}`);
    }

    const payload = (await response.json()) as GbifSearchResponse;
    const suggestions = (payload.results ?? [])
      .filter((item) => (item.kingdom ?? "").toLowerCase() === "plantae")
      .filter((item) => scoreGbifSuggestion(item, query) > 0)
      .sort((left, right) => scoreGbifSuggestion(right, query) - scoreGbifSuggestion(left, query))
      .map((item) => ({
        commonName: pickGbifCommonName(item, query).trim(),
        species: (item.canonicalName ?? item.scientificName ?? "").trim(),
      }))
      .filter((item) => item.commonName && item.species)
      .slice(0, 6);

    gbifCache.set(query, suggestions);
    return suggestions;
  } catch {
    return [];
  }
}

// Public endpoint — only queries public taxonomy APIs (iNaturalist / GBIF),
// no user data. Open so the public Garden Studio search works without login.
export const GET = withApiHandler(async (request: Request) => {
  const limit = await checkRateLimit("plants_search", clientIp(request), 60, 60);
  if (limit.limited) return rateLimitedResponse(limit.retryAfterSeconds);

  const query = new URL(request.url).searchParams.get("q") ?? "";
  const normalized = query.trim().toLowerCase();

  if (normalized.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const iNatResults = await suggestPlantsWithINaturalist(normalized);
  const gbifResults =
    normalized.length >= 3 && iNatResults.length < 5
      ? await suggestPlantsWithGbif(normalized)
      : [];

  const results = uniqueSuggestions([...iNatResults, ...gbifResults]).slice(0, 8);
  return NextResponse.json({ results });
});
