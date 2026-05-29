const CACHE_TTL_MS = 60 * 60 * 1000;
const weatherCache = new Map<string, { snapshot: WeatherSnapshot; at: number }>();
const aqCache = new Map<string, { data: AirQuality; at: number }>();

function cacheKey(lat: number, lon: number) {
  return `${lat.toFixed(2)},${lon.toFixed(2)}`;
}

export type WeatherSnapshot = {
  // Temperature
  temperatureC: number | null;
  apparentTemperatureC: number | null;
  dewPointC: number | null;
  todayHighC: number | null;
  todayLowC: number | null;
  // Atmosphere
  humidity: number | null;
  windSpeedKph: number | null;
  uvIndex: number | null;
  precipitationMmPerHour: number | null;
  // Soil
  soilTemperatureC: number | null;
  soilMoistureRatio: number | null;
  // Water balance
  evapotranspirationMm: number | null;
  rainProbability: number | null;
  rainTotalMm: number | null;
  // Light / time
  daylightHours: number | null;
  sunriseTime: string | null;
  sunsetTime: string | null;
  // Location
  elevationM: number | null;
  // Derived
  condition: string;
  summary: string;
  gddToday: number | null;
  // Risk flags
  frostRisk: boolean;
  heatRisk: boolean;
  rainLikely: boolean;
  // 7-day forecast
  dailyForecast: Array<{
    date: string;
    highC: number | null;
    lowC: number | null;
    rainProbability: number | null;
    rainTotalMm: number | null;
    evapotranspirationMm: number | null;
    daylightHours: number | null;
    sunriseTime: string | null;
    sunsetTime: string | null;
    heatRisk: boolean;
    frostRisk: boolean;
    heavyRain: boolean;
    highUv: boolean;
  }>;
};

export type AirQuality = {
  ozone: number | null;
  plantStressRisk: "low" | "moderate" | "high";
};

type ForecastResponse = {
  elevation?: number;
  current?: {
    temperature_2m?: number;
    apparent_temperature?: number;
    dew_point_2m?: number;
    relative_humidity_2m?: number;
    wind_speed_10m?: number;
    precipitation?: number;
    uv_index?: number;
    soil_temperature_0cm?: number;
    soil_moisture_0_to_1cm?: number;
    weather_code?: number;
  };
  daily?: {
    time?: string[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    precipitation_probability_max?: number[];
    precipitation_sum?: number[];
    et0_fao_evapotranspiration?: number[];
    daylight_duration?: number[];
    uv_index_max?: number[];
    sunrise?: string[];
    sunset?: string[];
  };
};

type AirQualityResponse = {
  current?: {
    pm2_5?: number;
    ozone?: number;
    european_aqi?: number;
  };
};

function mapWeatherCode(code: number): string {
  if (code === 0) return "Clear";
  if (code <= 2) return "Mostly clear";
  if (code === 3) return "Overcast";
  if (code <= 48) return "Fog";
  if (code <= 57) return "Drizzle";
  if (code <= 67) return "Rain";
  if (code <= 77) return "Snow";
  if (code <= 82) return "Rain showers";
  if (code <= 86) return "Snow showers";
  return "Thunderstorm";
}


function buildSummary(snapshot: Omit<WeatherSnapshot, "summary">): string {
  const alerts: string[] = [];
  if (snapshot.rainLikely) alerts.push("rain likely");
  if (snapshot.heatRisk) alerts.push("heat stress risk");
  if (snapshot.frostRisk) alerts.push("frost risk");
  if ((snapshot.uvIndex ?? 0) >= 7) alerts.push("high UV");
  if ((snapshot.windSpeedKph ?? 0) >= 40) alerts.push("high wind");
  if ((snapshot.soilMoistureRatio ?? 1) <= 0.22) alerts.push("low soil moisture");
  if ((snapshot.dewPointC ?? 0) >= 20) alerts.push("high humidity — disease risk");
  const tempStr = snapshot.temperatureC !== null ? ` at ${Math.round(snapshot.temperatureC)}°C` : "";
  const alertStr = alerts.length > 0 ? ` — ${alerts.join(", ")}` : "";
  return `${snapshot.condition}${tempStr}${alertStr}.`;
}

function readNumber(v: number | undefined): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export async function readWeatherSnapshot(latitude: number, longitude: number): Promise<WeatherSnapshot> {
  const key = cacheKey(latitude, longitude);
  const cached = weatherCache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.snapshot;

  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", latitude.toString());
  url.searchParams.set("longitude", longitude.toString());
  url.searchParams.set("current", [
    "temperature_2m", "apparent_temperature", "dew_point_2m",
    "relative_humidity_2m", "wind_speed_10m", "precipitation",
    "uv_index", "soil_temperature_0cm", "soil_moisture_0_to_1cm", "weather_code",
  ].join(","));
  url.searchParams.set("daily", [
    "temperature_2m_max", "temperature_2m_min",
    "precipitation_probability_max", "precipitation_sum",
    "et0_fao_evapotranspiration", "daylight_duration",
    "uv_index_max", "sunrise", "sunset",
  ].join(","));
  url.searchParams.set("forecast_days", "7");
  url.searchParams.set("timezone", "auto");

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Weather lookup failed with ${response.status}`);

  const payload = (await response.json()) as ForecastResponse;
  const weatherCode = payload.current?.weather_code ?? 0;
  const todayHighC = readNumber(payload.daily?.temperature_2m_max?.[0]);
  const todayLowC = readNumber(payload.daily?.temperature_2m_min?.[0]);
  const gddToday = todayHighC !== null && todayLowC !== null
    ? Math.max(0, Math.round(((todayHighC + todayLowC) / 2 - 10) * 10) / 10)
    : null;

  const dailyForecast = Array.from(
    { length: Math.min(payload.daily?.time?.length ?? 0, 7) },
    (_, i) => {
      const highC = readNumber(payload.daily?.temperature_2m_max?.[i]);
      const lowC = readNumber(payload.daily?.temperature_2m_min?.[i]);
      const rainTotalMm = readNumber(payload.daily?.precipitation_sum?.[i]);
      const uvIndex = readNumber(payload.daily?.uv_index_max?.[i]);
      const rawSunrise = payload.daily?.sunrise?.[i];
      const rawSunset = payload.daily?.sunset?.[i];
      return {
        date: payload.daily?.time?.[i] ?? new Date().toISOString().slice(0, 10),
        highC,
        lowC,
        rainProbability: readNumber(payload.daily?.precipitation_probability_max?.[i]),
        rainTotalMm,
        evapotranspirationMm: readNumber(payload.daily?.et0_fao_evapotranspiration?.[i]),
        daylightHours: typeof payload.daily?.daylight_duration?.[i] === "number"
          ? payload.daily.daylight_duration[i] / 3600 : null,
        sunriseTime: typeof rawSunrise === "string" ? rawSunrise.slice(11, 16) : null,
        sunsetTime: typeof rawSunset === "string" ? rawSunset.slice(11, 16) : null,
        heatRisk: highC !== null && highC >= 32,
        frostRisk: lowC !== null && lowC <= 2,
        heavyRain: rainTotalMm !== null && rainTotalMm >= 10,
        highUv: uvIndex !== null && uvIndex >= 7,
      };
    },
  );

  const base: Omit<WeatherSnapshot, "summary"> = {
    temperatureC: readNumber(payload.current?.temperature_2m),
    apparentTemperatureC: readNumber(payload.current?.apparent_temperature),
    dewPointC: readNumber(payload.current?.dew_point_2m),
    todayHighC,
    todayLowC,
    humidity: readNumber(payload.current?.relative_humidity_2m),
    windSpeedKph: readNumber(payload.current?.wind_speed_10m),
    uvIndex: readNumber(payload.current?.uv_index),
    precipitationMmPerHour: readNumber(payload.current?.precipitation),
    soilTemperatureC: readNumber(payload.current?.soil_temperature_0cm),
    soilMoistureRatio: readNumber(payload.current?.soil_moisture_0_to_1cm),
    evapotranspirationMm: readNumber(payload.daily?.et0_fao_evapotranspiration?.[0]),
    rainProbability: readNumber(payload.daily?.precipitation_probability_max?.[0]),
    rainTotalMm: readNumber(payload.daily?.precipitation_sum?.[0]),
    daylightHours: typeof payload.daily?.daylight_duration?.[0] === "number"
      ? payload.daily.daylight_duration[0] / 3600 : null,
    sunriseTime: typeof payload.daily?.sunrise?.[0] === "string"
      ? payload.daily.sunrise[0].slice(11, 16) : null,
    sunsetTime: typeof payload.daily?.sunset?.[0] === "string"
      ? payload.daily.sunset[0].slice(11, 16) : null,
    elevationM: readNumber(payload.elevation),
    condition: mapWeatherCode(weatherCode),
    gddToday,
    frostRisk: todayLowC !== null && todayLowC <= 2,
    heatRisk: todayHighC !== null && todayHighC >= 32,
    rainLikely:
      (readNumber(payload.daily?.precipitation_probability_max?.[0]) ?? 0) >= 55 ||
      (readNumber(payload.daily?.precipitation_sum?.[0]) ?? 0) >= 2,
    dailyForecast,
  };

  const snapshot: WeatherSnapshot = { ...base, summary: buildSummary(base) };
  weatherCache.set(key, { snapshot, at: Date.now() });
  return snapshot;
}

export async function readAirQuality(latitude: number, longitude: number): Promise<AirQuality | null> {
  const key = cacheKey(latitude, longitude);
  const cached = aqCache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.data;

  try {
    const url = new URL("https://air-quality-api.open-meteo.com/v1/air-quality");
    url.searchParams.set("latitude", latitude.toString());
    url.searchParams.set("longitude", longitude.toString());
    url.searchParams.set("current", ["pm2_5", "pm10", "ozone", "nitrogen_dioxide", "european_aqi"].join(","));

    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return null;

    const payload = (await response.json()) as AirQualityResponse;
    const pm25 = readNumber(payload.current?.pm2_5);
    const ozone = readNumber(payload.current?.ozone);
    const aqi = readNumber(payload.current?.european_aqi);

    const plantStressRisk: AirQuality["plantStressRisk"] =
      (aqi ?? 0) >= 100 || (pm25 ?? 0) >= 35 || (ozone ?? 0) >= 120
        ? "high"
        : (aqi ?? 0) >= 50 || (pm25 ?? 0) >= 12
          ? "moderate"
          : "low";

    const data: AirQuality = { ozone, plantStressRisk };

    aqCache.set(key, { data, at: Date.now() });
    return data;
  } catch {
    return null;
  }
}
