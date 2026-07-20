"use client";

import { useDeferredValue, useEffect, useId, useState } from "react";
import { LocateFixed, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type LocationSuggestion = {
  label: string;
  latitude: number;
  longitude: number;
  timezone?: string;
  country?: string;
  countryCode?: string;
  region?: string;
};

type WeatherSnapshot = {
  temperatureC: number;
  condition: string;
  summary: string;
  todayHighC: number;
  todayLowC: number;
  rainProbability: number;
};

type LocationPickerProps = {
  defaultLocation: string;
  defaultLatitude?: number;
  defaultLongitude?: number;
  required?: boolean;
};

async function readJsonSafe<T>(response: Response): Promise<T | null> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export function LocationPicker({
  defaultLocation,
  defaultLatitude,
  defaultLongitude,
  required = false,
}: LocationPickerProps) {
  const inputId = useId();
  const [query, setQuery] = useState(defaultLocation);
  const [latitude, setLatitude] = useState<number | undefined>(defaultLatitude);
  const [longitude, setLongitude] = useState<number | undefined>(defaultLongitude);
  const [timezone, setTimezone] = useState<string>("");
  const [countryCode, setCountryCode] = useState<string>("");
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [weather, setWeather] = useState<WeatherSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    let cancelled = false;

    async function runSearch() {
      if (deferredQuery.trim().length < 2) {
        setSuggestions([]);
        setError(null);
        setSearching(false);
        return;
      }

      setSearching(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/location/search?q=${encodeURIComponent(deferredQuery.trim())}`,
        );
        const payload = (await readJsonSafe<{
          results?: LocationSuggestion[];
          error?: string;
        }>(response)) ?? {};

        if (!response.ok) {
          throw new Error(payload.error || "Unable to search locations");
        }

        if (!cancelled) {
          setSuggestions(payload.results ?? []);
          setError(null);
        }
      } catch (searchError) {
        if (!cancelled) {
          setError(
            searchError instanceof Error
              ? searchError.message
              : "Unable to search locations",
          );
        }
      } finally {
        if (!cancelled) {
          setSearching(false);
        }
      }
    }

    runSearch();

    return () => {
      cancelled = true;
    };
  }, [deferredQuery]);

  useEffect(() => {
    let cancelled = false;

    async function loadWeather() {
      if (latitude === undefined || longitude === undefined) {
        setWeather(null);
        setError(null);
        return;
      }

      try {
        const response = await fetch(
          `/api/weather?latitude=${latitude}&longitude=${longitude}`,
        );
        const payload =
          (await readJsonSafe<
            Partial<WeatherSnapshot> & {
              error?: string;
            }
          >(response)) ?? {};

        if (!response.ok) {
          throw new Error(payload.error || "Unable to read weather");
        }

        if (!cancelled) {
          if (
            typeof payload.temperatureC === "number" &&
            typeof payload.condition === "string" &&
            typeof payload.summary === "string" &&
            typeof payload.todayHighC === "number" &&
            typeof payload.todayLowC === "number" &&
            typeof payload.rainProbability === "number"
          ) {
            setWeather({
              temperatureC: payload.temperatureC,
              condition: payload.condition,
              summary: payload.summary,
              todayHighC: payload.todayHighC,
              todayLowC: payload.todayLowC,
              rainProbability: payload.rainProbability,
            });
          } else {
            setWeather(null);
          }
          setError(null);
        }
      } catch (weatherError) {
        if (!cancelled) {
          setError(
            weatherError instanceof Error
              ? weatherError.message
              : "Unable to read weather",
          );
        }
      }
    }

    loadWeather();

    return () => {
      cancelled = true;
    };
  }, [latitude, longitude]);

  const chooseSuggestion = (suggestion: LocationSuggestion) => {
    setQuery(suggestion.label);
    setLatitude(suggestion.latitude);
    setLongitude(suggestion.longitude);
    setTimezone(suggestion.timezone ?? "");
    setCountryCode(suggestion.countryCode ?? "");
    setSuggestions([]);
    setError(null);
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError("Current location is not available in this browser.");
      return;
    }

    setLocating(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const nextLatitude = position.coords.latitude;
          const nextLongitude = position.coords.longitude;
          const response = await fetch(
            `/api/location/reverse?latitude=${nextLatitude}&longitude=${nextLongitude}`,
          );
          const payload =
            (await readJsonSafe<
              Partial<LocationSuggestion> & {
                error?: string;
              }
            >(response)) ?? {};

          if (!response.ok) {
            throw new Error(payload.error || "Unable to use current location");
          }

          if (
            typeof payload.label === "string" &&
            typeof payload.latitude === "number" &&
            typeof payload.longitude === "number"
          ) {
            chooseSuggestion({
              label: payload.label,
              latitude: payload.latitude,
              longitude: payload.longitude,
              timezone: payload.timezone,
              country: payload.country,
              countryCode: payload.countryCode,
              region: payload.region,
            });
          } else {
            throw new Error("Unable to use current location");
          }
        } catch (locationError) {
          setError(
            locationError instanceof Error
              ? locationError.message
              : "Unable to use current location",
          );
        } finally {
          setLocating(false);
        }
      },
      () => {
        setLocating(false);
        setError("Location permission was denied.");
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
      },
    );
  };

  return (
    <div className="auth-location-picker grid gap-4">
      <input type="hidden" name="location" value={query} />
      <input
        type="hidden"
        name="latitude"
        value={latitude === undefined ? "" : latitude}
      />
      <input
        type="hidden"
        name="longitude"
        value={longitude === undefined ? "" : longitude}
      />
      <input type="hidden" name="timezone" value={timezone} />
      <input type="hidden" name="countryCode" value={countryCode} />

      <label className="grid gap-2">
        <span className="text-sm font-medium text-[var(--color-ink)]">Where is your garden?</span>
        <div className="relative">
          <MapPin className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45" aria-hidden />
          <Input
            id={inputId}
            type="text"
            value={query}
            required={required}
            onChange={(event) => {
              setQuery(event.target.value);
              setLatitude(undefined);
              setLongitude(undefined);
              setTimezone("");
              setCountryCode("");
            }}
            placeholder="Search a city or neighborhood"
            autoComplete="off"
            className="h-12 rounded-xl pl-11"
          />
        </div>
        <span className="text-xs leading-5 text-[var(--color-muted)]">
          Use a city or neighborhood so weather and timing stay local.
        </span>
      </label>

      <div className="flex items-center gap-3">
        <Button
          type="button"
          onClick={useCurrentLocation}
          variant="outline"
          disabled={locating}
          className="h-10 rounded-xl px-3 text-xs"
        >
          <LocateFixed className="h-3.5 w-3.5" aria-hidden />
          {locating ? "Finding location..." : "Use my location"}
        </Button>
        {searching ? (
          <span className="text-xs text-[var(--color-muted)]">Searching locations...</span>
        ) : null}
      </div>

      {suggestions.length > 0 ? (
        <Card className="auth-location-suggestions grid gap-1.5 rounded-2xl p-2">
          {suggestions.map((suggestion) => (
            <button
              key={`${suggestion.label}-${suggestion.latitude}-${suggestion.longitude}`}
              type="button"
              onClick={() => chooseSuggestion(suggestion)}
              className="rounded-xl px-3 py-2.5 text-left transition hover:bg-white/10"
            >
              <p className="text-sm font-medium text-[var(--color-ink)]">
                {suggestion.label}
              </p>
              {suggestion.region || suggestion.country ? (
                <p className="mt-1 text-xs text-[var(--color-muted)]">
                  {[suggestion.region, suggestion.country].filter(Boolean).join(", ")}
                </p>
              ) : null}
            </button>
          ))}
        </Card>
      ) : null}

      {latitude !== undefined && longitude !== undefined && query ? (
        <Card className="auth-location-status flex items-center gap-3 rounded-2xl px-4 py-3">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/75">
            <MapPin className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">Selected location</p>
            <p className="mt-1 truncate text-sm font-medium text-[var(--color-ink)]">{query}</p>
          </div>
        </Card>
      ) : null}

      {weather ? (
        <Card className="auth-location-status rounded-2xl px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--color-muted)]">Local conditions</p>
            <span className="text-sm font-semibold text-[var(--color-ink)]">{Math.round(weather.temperatureC)}°C</span>
          </div>
          <p className="mt-1 text-sm font-medium text-[var(--color-ink)]">{weather.condition}</p>
          <p className="mt-1 text-xs leading-5 text-[var(--color-muted)]">{weather.summary}</p>
        </Card>
      ) : null}

      {error ? <p className="text-xs text-[var(--color-copper)]">{error}</p> : null}
    </div>
  );
}
