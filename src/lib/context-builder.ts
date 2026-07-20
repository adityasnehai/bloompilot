import { getDatabase } from "@/lib/database";
import { appConfig } from "@/lib/app-config";
import { getPlantCareKnowledge } from "@/lib/plant-knowledge";
import { readWeatherSnapshot, readAirQuality } from "@/lib/weather";
import { getGardenTypeProfile, normalizeGardenTypeValue } from "@/lib/garden-type";
import { getStudioLayout, studioZoneAt } from "@/lib/studio-layout";

type UserRow = {
  id: number;
  name: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
  garden_type: string;
  reminder_window: string;
  channels_json: string;
  timezone: string | null;
};

type PlantRow = {
  id: string;
  nickname: string;
  species: string;
  placement: string;
  sunlight: string;
  watering_interval_days: number;
  notes: string;
  photo_blob: Uint8Array | null;
};

type PlantSource = ContextJson["plants"][number]["source"];

type GardenContextWarning = {
  level: "low" | "medium" | "high";
  message: string;
};

export type ContextJson = {
  context_id: string;
  generated_at: string;
  user: {
    user_id: string;
    name: string;
    experience_level: "beginner";
    notification_preference: {
      time_window: string;
      channels: string[];
    };
  };
  garden: {
    garden_id: string;
    location: {
      input: string;
      city: string;
      country: string | null;
      timezone: string | null;
      lat: number | null;
      lon: number | null;
      source: string;
    };
    garden_type: string;
    exposure: "none" | "partial" | "full" | "elevated";
    weather_affected: boolean;
    watering_modifier: number;
    planner_note: string;
    default_sunlight: string;
    notes: string | null;
  };
  environment: {
    weather_source: string;
    // Temperature
    temperature_c: number | null;
    apparent_temperature_c: number | null;
    dew_point_c: number | null;
    today_high_c: number | null;
    today_low_c: number | null;
    // Atmosphere
    humidity_percent: number | null;
    wind_speed_kph: number | null;
    uv_index: number | null;
    // Soil
    soil_temperature_c: number | null;
    soil_moisture: number | null;
    // Water balance
    rainfall_mm: number | null;
    evapotranspiration_mm: number | null;
    // Light / timing
    daylight_hours: number | null;
    sunrise_time: string | null;
    sunset_time: string | null;
    // Location physical
    elevation_m: number | null;
    // Growing metrics
    gdd_today: number | null;
    // Context
    season: string | null;
    hemisphere: "northern" | "southern";
    climate_zone: string | null;
    usda_zone: string | null;
    // Air quality
    air_quality: {
      ozone: number | null;
      plant_stress_risk: string;
    } | null;
    // Risk flags
    risk_flags: {
      heat_stress: boolean;
      frost_risk: boolean;
      heavy_rain: boolean;
      high_uv: boolean;
      high_wind: boolean;
      disease_risk: boolean;
    };
    daily_forecast: Array<{
      date: string;
      high_c: number | null;
      low_c: number | null;
      rain_probability: number | null;
      rainfall_mm: number | null;
      evapotranspiration_mm: number | null;
      daylight_hours: number | null;
      sunrise_time: string | null;
      sunset_time: string | null;
      heat_stress: boolean;
      frost_risk: boolean;
      heavy_rain: boolean;
      high_uv: boolean;
    }>;
  };
  plants: Array<{
    plant_id: string;
    common_name: string;
    species: string | null;
    source: "search" | "image" | "manual";
    identification_confidence: number | null;
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
    image_url: string | null;
    plant_knowledge: {
      source: string;
      watering_baseline: string | null;
      watering_days_min: number | null;
      watering_days_max: number | null;
      sunlight_preference: string | null;
      soil_preference: string | null;
      temperature_range_c: string | null;
      temperature_min_c: number | null;
      temperature_max_c: number | null;
      humidity_preference: string | null;
      humidity_min_percent: number | null;
      humidity_max_percent: number | null;
      ph_min: number | null;
      ph_max: number | null;
      pest_list: string[];
      disease_list: string[];
      toxicity: string | null;
      pruning_months: string | null;
      nutrient_requirements: string | null;
      companion_plants: string[];
      care_notes: string[];
      confidence: string;
    };
    missing_data: string[];
    // User-selected planning band from Garden Studio. It is not measured exposure.
    studio_zone: "full_sun" | "partial_shade" | "shade" | null;
  }>;
  evidence: Array<{
    type: string;
    source: string;
    supports: string;
  }>;
  warnings: GardenContextWarning[];
  agent_ready: boolean;
};

function parseChannels(raw: string) {
  try {
    const parsed = JSON.parse(raw) as string[];
    return parsed.filter(Boolean);
  } catch {
    return ["email"];
  }
}

function parsePlantNotes(notes: string) {
  const map = new Map<string, string>();
  notes
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .forEach((pair) => {
      const [key, ...rest] = pair.split("=");
      if (!key) return;
      map.set(key.trim().toLowerCase(), rest.join("=").trim());
    });
  return map;
}

function splitLocation(value: string) {
  const parts = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return {
    city: parts[0] || "",
    country: parts.length > 1 ? parts[parts.length - 1] : null,
  };
}

function getUsdaZone(lat: number | null): string | null {
  if (lat === null) return null;
  const a = Math.abs(lat);
  if (a < 10) return "Zone 13 (tropical, frost-free)";
  if (a < 15) return "Zone 12";
  if (a < 20) return "Zone 11";
  if (a < 25) return "Zone 10";
  if (a < 30) return "Zone 9";
  if (a < 35) return "Zone 8";
  if (a < 40) return "Zone 7";
  if (a < 45) return "Zone 6";
  if (a < 50) return "Zone 5";
  if (a < 55) return "Zone 4";
  if (a < 60) return "Zone 3";
  return "Zone 2 (subarctic)";
}

export function getClimateZone(lat: number | null, lon: number | null): string | null {
  if (lat === null) return null;
  const absLat = Math.abs(lat);
  // Simplified Köppen classification by latitude band
  if (absLat < 15) return "Tropical (hot and humid year-round, high rainfall)";
  if (absLat < 25) return "Subtropical (warm to hot, distinct wet/dry seasons)";
  if (absLat < 35) {
    // Rough arid/semi-arid vs Mediterranean distinction by longitude
    if (lon !== null && ((lon >= -10 && lon <= 40) || (lon >= 115 && lon <= 155))) {
      return "Mediterranean (dry summers, mild wet winters)";
    }
    return "Arid/Semi-arid (low rainfall, high temperature variation)";
  }
  if (absLat < 50) return "Temperate (mild summers, cool winters, year-round rain)";
  if (absLat < 65) return "Continental (warm summers, cold winters, moderate rainfall)";
  return "Polar/Subarctic (short summers, very cold winters)";
}

function getSeason(latitude?: number | null) {
  const month = new Date().getUTCMonth();
  const northern = latitude === undefined || latitude === null ? true : latitude >= 0;
  if (northern) {
    if (month >= 2 && month <= 4) return "spring";
    if (month >= 5 && month <= 7) return "summer";
    if (month >= 8 && month <= 10) return "autumn";
    return "winter";
  }
  if (month >= 2 && month <= 4) return "autumn";
  if (month >= 5 && month <= 7) return "winter";
  if (month >= 8 && month <= 10) return "spring";
  return "summer";
}

export function normalizeSunlight(value: string) {
  const key = value.toLowerCase().trim();
  if (key === "low light") {
    return {
      label: "low_light",
      direct_sun_hours_range: "0-2",
      description: "Low direct sunlight and mostly shaded exposure",
    };
  }
  if (key === "partial sun") {
    return {
      label: "partial_sun",
      direct_sun_hours_range: "3-6",
      description: "Balanced sun exposure for part of the day",
    };
  }
  if (key === "full sun") {
    return {
      label: "full_sun",
      direct_sun_hours_range: "6+",
      description: "Strong direct sunlight for most of the day",
    };
  }
  return {
    label: "bright_indirect",
    direct_sun_hours_range: "0-2",
    description: "Bright area without strong direct sun",
  };
}

export function normalizePlacement(value: string) {
  const key = value.toLowerCase().trim();
  if (!key) return "not_set";
  if (key.includes("indoor")) return "indoor";
  if (key.includes("balcony")) return "balcony";
  if (key.includes("terrace") || key.includes("rooftop")) return "terrace";
  if (key.includes("patio") || key.includes("container")) return "balcony";
  if (key.includes("backyard") || key.includes("outdoor")) return "outdoor";
  return "outdoor";
}

export function normalizeSoilType(value: string) {
  const key = value.toLowerCase().trim();
  if (key.includes("potting")) return "potting_mix";
  if (key.includes("sandy")) return "sandy";
  if (key.includes("clay")) return "clay";
  return "loamy";
}

export function normalizeWateringMode(value: string): "auto" | "custom" {
  return value.toLowerCase().trim() === "custom" ? "custom" : "auto";
}

export async function buildUserContext(userId: number) {
  const database = getDatabase();
  const user = database
    .prepare(
      `
      SELECT id, name, reminder_window, channels_json
      FROM users
      WHERE id = ?
      `,
    )
    .get(userId) as Pick<UserRow, "id" | "name" | "reminder_window" | "channels_json"> | undefined;

  if (!user) {
    throw new Error("User not found");
  }

  return {
    user_id: `user_${user.id}`,
    name: user.name,
    experience_level: "beginner" as const,
    notification_preference: {
      time_window: user.reminder_window || "morning",
      channels: parseChannels(user.channels_json),
    },
  };
}

export async function buildGardenSetupContext(userId: number) {
  const database = getDatabase();
  const user = database
    .prepare(
      `
      SELECT id, location, latitude, longitude, garden_type, timezone
      FROM users
      WHERE id = ?
      `,
    )
    .get(userId) as Pick<UserRow, "id" | "location" | "latitude" | "longitude" | "garden_type" | "timezone"> | undefined;

  if (!user) {
    throw new Error("User not found");
  }

  const locationParts = splitLocation(user.location || "");

  return {
    garden_id: `garden_${user.id}`,
    location: {
      input: user.location || "",
      city: locationParts.city,
      country: locationParts.country,
      timezone: user.timezone ?? null,
      lat: user.latitude ?? null,
      lon: user.longitude ?? null,
      source:
        user.latitude !== null && user.longitude !== null
          ? "saved_location_coordinates"
          : "user_input_only",
    },
    garden_type: normalizeGardenTypeValue(user.garden_type),
    exposure: getGardenTypeProfile(user.garden_type).exposure,
    weather_affected: getGardenTypeProfile(user.garden_type).weatherAffected,
    watering_modifier: getGardenTypeProfile(user.garden_type).wateringModifier,
    planner_note: getGardenTypeProfile(user.garden_type).plannerNote,
    default_sunlight: "bright_indirect",
    notes: null,
  };
}

export async function buildEnvironmentContext(location: {
  lat: number | null;
  lon: number | null;
  latitude?: number | null;
  longitude?: number | null;
}) {
  const lat = location.lat ?? location.latitude ?? null;
  const lon = location.lon ?? location.longitude ?? null;

  if (lat === null || lon === null) {
    return {
      weather_source: "open_meteo",
      temperature_c: null, apparent_temperature_c: null, dew_point_c: null,
      today_high_c: null, today_low_c: null,
      humidity_percent: null, wind_speed_kph: null, uv_index: null,
      soil_temperature_c: null, soil_moisture: null,
      rainfall_mm: null, evapotranspiration_mm: null,
      daylight_hours: null, sunrise_time: null, sunset_time: null,
      elevation_m: null, gdd_today: null,
      season: null, hemisphere: "northern" as const,
      climate_zone: null, usda_zone: null, air_quality: null,
      risk_flags: { heat_stress: false, frost_risk: false, heavy_rain: false, high_uv: false, high_wind: false, disease_risk: false },
      daily_forecast: [],
    };
  }

  const hemisphere: "northern" | "southern" = lat >= 0 ? "northern" : "southern";
  const climate_zone = getClimateZone(lat, lon);
  const usda_zone = getUsdaZone(lat);
  const season = getSeason(lat);

  try {
    const [weather, aq] = await Promise.all([
      readWeatherSnapshot(lat, lon),
      readAirQuality(lat, lon),
    ]);

    const dewPoint = weather.dewPointC === null ? null : Math.round(weather.dewPointC * 10) / 10;
    const diseaseRisk = (weather.humidity ?? 0) >= 80 && (dewPoint ?? 0) >= 18;

    return {
      weather_source: "open_meteo",
      temperature_c: weather.temperatureC === null ? null : Math.round(weather.temperatureC),
      apparent_temperature_c: weather.apparentTemperatureC === null ? null : Math.round(weather.apparentTemperatureC),
      dew_point_c: dewPoint,
      today_high_c: weather.todayHighC === null ? null : Math.round(weather.todayHighC),
      today_low_c: weather.todayLowC === null ? null : Math.round(weather.todayLowC),
      humidity_percent: weather.humidity,
      wind_speed_kph: weather.windSpeedKph,
      uv_index: weather.uvIndex,
      soil_temperature_c: weather.soilTemperatureC === null ? null : Math.round(weather.soilTemperatureC * 10) / 10,
      soil_moisture: weather.soilMoistureRatio,
      rainfall_mm: weather.rainTotalMm,
      evapotranspiration_mm: weather.evapotranspirationMm,
      daylight_hours: weather.daylightHours,
      sunrise_time: weather.sunriseTime,
      sunset_time: weather.sunsetTime,
      elevation_m: weather.elevationM,
      gdd_today: weather.gddToday,
      season,
      hemisphere,
      climate_zone,
      usda_zone,
      air_quality: aq ? { ozone: aq.ozone, plant_stress_risk: aq.plantStressRisk } : null,
      risk_flags: {
        heat_stress: weather.heatRisk,
        frost_risk: weather.frostRisk,
        heavy_rain: weather.rainTotalMm !== null && weather.rainTotalMm >= 10,
        high_uv: (weather.uvIndex ?? 0) >= 7,
        high_wind: (weather.windSpeedKph ?? 0) >= 40,
        disease_risk: diseaseRisk,
      },
      daily_forecast: weather.dailyForecast.map((day) => ({
        date: day.date,
        high_c: day.highC === null ? null : Math.round(day.highC),
        low_c: day.lowC === null ? null : Math.round(day.lowC),
        rain_probability: day.rainProbability,
        rainfall_mm: day.rainTotalMm,
        evapotranspiration_mm: day.evapotranspirationMm,
        daylight_hours: day.daylightHours,
        sunrise_time: day.sunriseTime,
        sunset_time: day.sunsetTime,
        heat_stress: day.heatRisk,
        frost_risk: day.frostRisk,
        heavy_rain: day.heavyRain,
        high_uv: day.highUv,
      })),
    };
  } catch {
    return {
      weather_source: "open_meteo",
      temperature_c: null, apparent_temperature_c: null, dew_point_c: null,
      today_high_c: null, today_low_c: null,
      humidity_percent: null, wind_speed_kph: null, uv_index: null,
      soil_temperature_c: null, soil_moisture: null,
      rainfall_mm: null, evapotranspiration_mm: null,
      daylight_hours: null, sunrise_time: null, sunset_time: null,
      elevation_m: null, gdd_today: null,
      season, hemisphere, climate_zone, usda_zone, air_quality: null,
      risk_flags: { heat_stress: false, frost_risk: false, heavy_rain: false, high_uv: false, high_wind: false, disease_risk: false },
      daily_forecast: [],
    };
  }
}

export async function buildPlantContext(userId: number, gardenType?: string) {
  const database = getDatabase();
  const plants = database
    .prepare(
      `
      SELECT id, nickname, species, placement, sunlight, watering_interval_days, notes, photo_blob
      FROM plants
      WHERE user_id = ?
      ORDER BY datetime(added_at) DESC
      `,
    )
    .all(userId) as PlantRow[];

  // Load studio layout once and build a plantId → zone lookup map.
  // Convert saved canvas position into a user-selected planning band.
  const effectiveGardenType = gardenType ?? "balcony";
  const layout = getStudioLayout(userId, effectiveGardenType);
  const zoneMap = new Map<string, "full_sun" | "partial_shade" | "shade">();
  if (layout) {
    for (const lp of layout.plants) {
      if (lp.plantId) {
        zoneMap.set(lp.plantId, studioZoneAt(lp.z, effectiveGardenType));
      }
    }
  }

  const contexts = await Promise.all(
    plants.map(async (plant) => {
      const noteMap = parsePlantNotes(plant.notes);
      const source = (noteMap.get("source") || "manual").toLowerCase();
      const encodedImageUrl = noteMap.get("image_url") || "";
      let searchedImageUrl: string | null = null;
      if (encodedImageUrl) {
        try {
          searchedImageUrl = decodeURIComponent(encodedImageUrl);
        } catch {
          searchedImageUrl = encodedImageUrl;
        }
      }
      const soilRaw = noteMap.get("soil") || "";
      const wateringModeRaw = noteMap.get("watering_mode") || "auto";
      const customDaysRaw = noteMap.get("custom_days") || "";

      const potSizeRaw = noteMap.get("pot_size") || "medium";
      const potMaterialRaw = noteMap.get("pot_material") || "plastic";
      const drainageRaw = noteMap.get("drainage_holes") || "yes";
      const mixRaw = noteMap.get("mix_ratio") || "balanced";
      const placement = normalizePlacement(plant.placement);
      const soilInferred =
        soilRaw ||
        (placement === "indoor" || placement === "balcony" || placement === "terrace"
          ? "potting_mix"
          : "loamy");
      const soil = normalizeSoilType(soilInferred);
      const wateringMode = normalizeWateringMode(wateringModeRaw);
      const customDays =
        wateringMode === "custom"
          ? Number.parseInt(customDaysRaw || `${plant.watering_interval_days}`, 10)
          : null;
      const species =
        plant.species.trim() && !plant.species.toLowerCase().includes("unknown")
          ? plant.species
          : null;
      const plantKnowledge = await getPlantCareKnowledge(species || plant.nickname);

      const missingData: string[] = [];
      if (!species) {
        missingData.push("species");
      }

      const potSize: "small" | "medium" | "large" =
        potSizeRaw === "small" || potSizeRaw === "large" ? potSizeRaw : "medium";
      const potMaterial: "plastic" | "ceramic" | "terracotta" | "fabric" =
        potMaterialRaw === "ceramic" ||
        potMaterialRaw === "terracotta" ||
        potMaterialRaw === "fabric"
          ? potMaterialRaw
          : "plastic";
      const substrateMix: "balanced" | "high_organic" | "high_mineral" =
        mixRaw === "high_organic" || mixRaw === "high_mineral" ? mixRaw : "balanced";

      return {
        plant_id: plant.id,
        common_name: plant.nickname,
        species,
        source: (
          source === "image"
            ? "image"
            : source === "search"
              ? "search"
              : "manual"
        ) as PlantSource,
        identification_confidence: null,
        placement,
        sunlight: normalizeSunlight(plant.sunlight),
        soil: {
          type: soil,
          drainage: soil === "clay" ? "low" : soil === "sandy" ? "high" : "medium",
          user_confirmed: Boolean(soilRaw),
        },
        watering: {
          mode: wateringMode,
          custom_interval_days:
            wateringMode === "custom" && Number.isFinite(customDays) ? customDays : null,
        },
        pot_profile: {
          size: potSize,
          material: potMaterial,
          drainage_holes: drainageRaw !== "no",
          substrate_mix: substrateMix,
        },
        image_url: plant.photo_blob
          ? `/api/plants/photo?plantId=${encodeURIComponent(plant.id)}`
          : searchedImageUrl
            ? `/api/plant-image?url=${encodeURIComponent(searchedImageUrl)}`
            : null,
        plant_knowledge: plantKnowledge,
        missing_data: missingData,
        studio_zone: zoneMap.get(plant.id) ?? null,
      };
    }),
  );

  return contexts;
}

export function detectMissingContext(context: ContextJson) {
  const warnings: GardenContextWarning[] = [];

  if (context.garden.location.lat === null || context.garden.location.lon === null) {
    warnings.push({
      level: "high",
      message: "Location is missing coordinates. Weather context cannot be resolved.",
    });
  }

  if (context.environment.temperature_c === null) {
    warnings.push({
      level: "medium",
      message: "Environment data is unavailable right now. Retry weather sync.",
    });
  }

  if (context.plants.some((plant) => plant.species === null)) {
    warnings.push({
      level: "medium",
      message: "One or more plants need identification before evidence-based planning.",
    });
  }

  if (
    appConfig.strictProductionMode &&
    context.plants.some(
      (plant) =>
        !plant.plant_knowledge.watering_baseline ||
        !plant.plant_knowledge.sunlight_preference ||
        !plant.plant_knowledge.soil_preference,
    )
  ) {
    warnings.push({
      level: "high",
      message:
        "Strict mode: plant care knowledge is incomplete. Perenual-backed evidence is required.",
    });
  }

  return warnings;
}

export function buildEvidenceRefs(context: ContextJson) {
  const refs: ContextJson["evidence"] = [];

  if (context.garden.location.lat !== null && context.garden.location.lon !== null) {
    refs.push({
      type: "location",
      source: "Saved garden location coordinates",
      supports: "latitude and longitude used for weather lookup",
    });
  }

  if (context.environment.temperature_c !== null) {
    refs.push({
      type: "weather",
      source: "Open-Meteo Forecast API",
      supports: "temperature, humidity, rainfall, UV and risk flags",
    });
  }

  if (context.plants.length > 0) {
    refs.push(
      {
        type: "plant_identity",
        source: "PlantNet API, iNaturalist, or GBIF user-selected search result",
        supports: "common name and species identification",
      },
      {
        type: "user_input",
        source: "Add Plant Form",
        supports: "placement, sunlight, soil and watering mode",
      },
    );
  }

  if (context.plants.some((plant) => plant.studio_zone !== null)) {
    refs.push({
      type: "user_input",
      source: "Garden Studio saved layout",
      supports: "user-arranged light planning band; not measured sunlight exposure",
    });
  }

  return refs;
}

export function saveContextSnapshot(userId: number, context: ContextJson) {
  const database = getDatabase();
  const generatedAt = context.generated_at;
  const warnings = context.warnings;

  database
    .prepare(
      `
      INSERT INTO garden_context_snapshots (
        id, user_id, context_json, generated_at, agent_ready, warnings_json
      )
      VALUES (?, ?, ?, ?, ?, ?)
      `,
    )
    .run(
      context.context_id,
      userId,
      JSON.stringify(context),
      generatedAt,
      context.agent_ready ? 1 : 0,
      JSON.stringify(warnings),
    );

  const insertEvidence = database.prepare(
    `
    INSERT INTO plant_evidence (
      id, user_id, plant_id, evidence_type, source, value_json, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
  );

  for (const plant of context.plants) {
    insertEvidence.run(
      crypto.randomUUID(),
      userId,
      plant.plant_id,
      "plant_identity",
      plant.source,
      JSON.stringify({
        common_name: plant.common_name,
        species: plant.species,
      }),
      generatedAt,
    );

    insertEvidence.run(
      crypto.randomUUID(),
      userId,
      plant.plant_id,
      "user_environment_input",
      "Add Plant Form",
      JSON.stringify({
        placement: plant.placement,
        sunlight: plant.sunlight.label,
        soil: plant.soil.type,
        watering_mode: plant.watering.mode,
      }),
      generatedAt,
    );
  }
}

export async function buildGardenContext(userId: number) {
  const user = await buildUserContext(userId);
  const garden = await buildGardenSetupContext(userId);
  const environment = await buildEnvironmentContext(garden.location);
  const plants = await buildPlantContext(userId, garden.garden_type);

  // Gate risk flags based on garden exposure — indoor plants don't get frost/wind/rain warnings
  const profile = getGardenTypeProfile(garden.garden_type);
  const gatedEnvironment = {
    ...environment,
    risk_flags: {
      heat_stress: environment.risk_flags.heat_stress && profile.weatherAffected,
      frost_risk: environment.risk_flags.frost_risk && profile.frostRelevant,
      heavy_rain: environment.risk_flags.heavy_rain && profile.rainRelevant,
      high_uv: environment.risk_flags.high_uv && profile.uvExposed,
      high_wind: environment.risk_flags.high_wind && profile.windRelevant,
      disease_risk: environment.risk_flags.disease_risk,
    },
    // Suppress outdoor weather fields for fully indoor gardens
    rainfall_mm: profile.rainRelevant ? environment.rainfall_mm : null,
    wind_speed_kph: profile.windRelevant ? environment.wind_speed_kph : null,
    uv_index: profile.uvExposed ? environment.uv_index : null,
  };

  const context: ContextJson = {
    context_id: `ctx_${crypto.randomUUID()}`,
    generated_at: new Date().toISOString(),
    user,
    garden,
    environment: gatedEnvironment,
    plants,
    evidence: [],
    warnings: [],
    agent_ready: false,
  };

  context.evidence = buildEvidenceRefs(context);
  context.warnings = detectMissingContext(context);
  context.agent_ready =
    context.garden.location.lat !== null &&
    context.garden.location.lon !== null &&
    context.environment.temperature_c !== null &&
    context.plants.length > 0 &&
    context.plants.every((plant) => plant.species !== null) &&
    (!appConfig.strictProductionMode ||
      context.plants.every(
        (plant) =>
          Boolean(plant.plant_knowledge.watering_baseline) &&
          Boolean(plant.plant_knowledge.sunlight_preference) &&
          Boolean(plant.plant_knowledge.soil_preference),
      ));

  saveContextSnapshot(userId, context);
  return context;
}

export function isGardenContextSnapshotStale(
  context: ContextJson | null,
  maxAgeMs = 30 * 60 * 1000,
) {
  if (!context) return true;
  if (!context.environment) return true;
  if (!Array.isArray(context.environment?.daily_forecast)) return true;
  if (!("evapotranspiration_mm" in context.environment)) return true;
  if (!("wind_speed_kph" in context.environment)) return true;
  if (!context.plants.every((plant) => "image_url" in plant)) return true;

  const generatedAt = new Date(context.generated_at).getTime();
  if (!Number.isFinite(generatedAt)) return true;
  return Date.now() - generatedAt > maxAgeMs;
}

export function readLatestContextSnapshot(userId: number) {
  const database = getDatabase();
  const row = database
    .prepare(
      `
      SELECT context_json
      FROM garden_context_snapshots
      WHERE user_id = ?
      ORDER BY datetime(generated_at) DESC
      LIMIT 1
      `,
    )
    .get(userId) as { context_json: string } | undefined;

  if (!row) {
    return null;
  }

  try {
    return JSON.parse(row.context_json) as ContextJson;
  } catch {
    return null;
  }
}
