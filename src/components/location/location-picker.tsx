"use client";

import { useDeferredValue, useEffect, useId, useState } from "react";

type LocationSuggestion = {
  label: string;
  latitude: number;
  longitude: number;
  timezone?: string;
  country?: string;
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
    <div className="grid gap-3">
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

      <label className="flex flex-col gap-2">
        <span className="field-label">Primary garden location</span>
        <input
          id={inputId}
          type="text"
          value={query}
          required={required}
          onChange={(event) => {
            setQuery(event.target.value);
            setLatitude(undefined);
            setLongitude(undefined);
          }}
          placeholder="Search city or neighborhood"
          className="field-control"
          autoComplete="off"
        />
        <span className="field-hint">
          Search manually and pick a suggested match, or use your current location.
        </span>
      </label>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={useCurrentLocation}
          className="button-secondary"
          disabled={locating}
        >
          {locating ? "Detecting..." : "Use current location"}
        </button>
        {searching ? (
          <span className="text-sm text-[var(--color-muted)]">Searching...</span>
        ) : null}
      </div>

      {suggestions.length > 0 ? (
        <div className="grid gap-2 rounded-[24px] border border-[rgba(16,52,39,0.08)] bg-white p-3 shadow-[0_14px_30px_rgba(16,52,39,0.08)]">
          {suggestions.map((suggestion) => (
            <button
              key={`${suggestion.label}-${suggestion.latitude}-${suggestion.longitude}`}
              type="button"
              onClick={() => chooseSuggestion(suggestion)}
              className="rounded-[18px] px-4 py-3 text-left transition hover:bg-[rgba(245,237,222,0.72)]"
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
        </div>
      ) : null}

      {latitude !== undefined && longitude !== undefined && query ? (
        <div className="surface-card p-4">
          <p className="text-sm font-medium text-[var(--color-ink)]">Selected location</p>
          <p className="mt-1 text-sm text-[var(--color-muted)]">{query}</p>
        </div>
      ) : null}

      {weather ? (
        <div className="surface-card-muted p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-muted)]">
            Local conditions
          </p>
          <p className="mt-2 text-sm font-medium text-[var(--color-ink)]">
            {weather.condition} · {Math.round(weather.temperatureC)}°C
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
            {weather.summary}
          </p>
          <p className="mt-2 text-xs text-[var(--color-muted)]">
            High {Math.round(weather.todayHighC)}°C · Low {Math.round(weather.todayLowC)}°C · Rain chance {weather.rainProbability}%
          </p>
        </div>
      ) : null}

      {error ? <p className="field-hint text-[var(--color-copper)]">{error}</p> : null}
    </div>
  );
}
