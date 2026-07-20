import { appConfig } from "@/lib/app-config";

export type LocationSuggestion = {
  label: string;
  latitude: number;
  longitude: number;
  timezone?: string;
  country?: string;
  countryCode?: string;
  region?: string;
};

type OpenMeteoResult = {
  name: string;
  country?: string;
  country_code?: string;
  admin1?: string;
  latitude: number;
  longitude: number;
  timezone?: string;
};

type OpenMeteoResponse = {
  results?: OpenMeteoResult[];
};

type OpenMeteoTimezoneResponse = {
  timezone?: string;
};

type NominatimResponse = {
  display_name?: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    county?: string;
    state?: string;
    country?: string;
    country_code?: string;
  };
  lat?: string;
  lon?: string;
};

function buildLabel(parts: Array<string | undefined>) {
  return parts.filter(Boolean).join(", ");
}

function mapOpenMeteoResult(result: OpenMeteoResult): LocationSuggestion {
  return {
    label: buildLabel([result.name, result.admin1, result.country]),
    latitude: result.latitude,
    longitude: result.longitude,
    timezone: result.timezone,
    country: result.country,
    countryCode: result.country_code?.toLowerCase(),
    region: result.admin1,
  };
}

export async function searchLocations(query: string) {
  const cleaned = query.trim();

  if (cleaned.length < 2) {
    return [] as LocationSuggestion[];
  }

  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", cleaned);
  url.searchParams.set("count", "6");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");

  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(`Location search failed with ${response.status}`);
  }

  const payload = (await response.json()) as OpenMeteoResponse;
  return (payload.results ?? []).map(mapOpenMeteoResult);
}

async function readTimezoneAtCoordinates(latitude: number, longitude: number) {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", latitude.toString());
  url.searchParams.set("longitude", longitude.toString());
  url.searchParams.set("current", "temperature_2m");
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("forecast_days", "1");

  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10000) });
  if (!response.ok) {
    return undefined;
  }

  const payload = (await response.json()) as OpenMeteoTimezoneResponse;
  return typeof payload.timezone === "string" && payload.timezone.trim()
    ? payload.timezone.trim()
    : undefined;
}

export async function reverseGeocodeLocation(latitude: number, longitude: number) {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", latitude.toString());
  url.searchParams.set("lon", longitude.toString());
  url.searchParams.set("zoom", "12");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("email", appConfig.supportEmail);

  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
    headers: {
      "User-Agent": `${appConfig.name}/1.0 (${appConfig.supportEmail})`,
      Referer: appConfig.siteUrl,
    },
  });

  if (!response.ok) {
    throw new Error(`Reverse geocoding failed with ${response.status}`);
  }

  const payload = (await response.json()) as NominatimResponse;
  const locality =
    payload.address?.city ??
    payload.address?.town ??
    payload.address?.village ??
    payload.address?.municipality ??
    payload.address?.county;

  const timezone = await readTimezoneAtCoordinates(latitude, longitude);

  return {
    label:
      buildLabel([
        locality,
        payload.address?.state,
        payload.address?.country,
      ]) || payload.display_name || "Current location",
    latitude,
    longitude,
    timezone,
    country: payload.address?.country,
    countryCode: payload.address?.country_code?.toLowerCase(),
  } satisfies LocationSuggestion;
}
