import { getDatabase } from "@/lib/database";
import { requestOpenAIChat } from "@/lib/openai";
import { randomUUID } from "node:crypto";

type SeasonName = "spring" | "summer" | "fall" | "winter";

export type SeasonalAdvice = {
  season: SeasonName;
  year: number;
  tips: string[];
  focusAreas: string[];
  warning?: string;
  generatedAt: string;
};

function currentSeason(): SeasonName {
  const month = new Date().getMonth() + 1;
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "fall";
  return "winter";
}

function currentYear() {
  return new Date().getFullYear();
}

type StoredRow = { advice_json: string; generated_at: string };

export async function getStoredSeasonalRecommendations(userId: number): Promise<SeasonalAdvice | null> {
  const db = await getDatabase();
  const season = currentSeason();
  const year = currentYear();

  const row = await db
    .prepare(`SELECT advice_json, generated_at FROM seasonal_recommendations WHERE user_id = ? AND season = ? AND year = ?`)
    .get(userId, season, year) as StoredRow | undefined;

  if (!row) return null;

  try {
    return JSON.parse(row.advice_json) as SeasonalAdvice;
  } catch {
    return null;
  }
}

type PlantContext = {
  nickname: string;
  species: string | null;
  healthScore?: number | null;
};

type WeatherContext = {
  temperatureC: number | null;
  humidity: number | null;
  windSpeedKph?: number | null;
  uvIndex?: number | null;
  soilTemperatureC?: number | null;
  heatRisk: boolean;
  frostRisk: boolean;
  rainLikely: boolean;
  highWind?: boolean;
  climateZone?: string | null;
  hemisphere?: "northern" | "southern";
};

export async function generateSeasonalRecommendations(
  userId: number,
  gardenType: string,
  location: string,
  plants: PlantContext[],
  weather?: WeatherContext | null,
): Promise<SeasonalAdvice> {
  const season = currentSeason();
  const year = currentYear();
  const db = await getDatabase();

  const plantList =
    plants.length > 0
      ? plants
          .slice(0, 12)
          .map((p) => {
            const label = p.species ? `${p.nickname} (${p.species})` : p.nickname;
            return p.healthScore !== null && p.healthScore !== undefined
              ? `${label} — health ${p.healthScore}/100`
              : label;
          })
          .join("\n")
      : "a mixed garden";

  const weatherSection = weather
    ? [
        `Current weather: ${weather.temperatureC !== null ? `${weather.temperatureC}°C` : "unknown"}, humidity ${weather.humidity !== null ? `${weather.humidity}%` : "unknown"}`,
        weather.windSpeedKph != null ? `wind ${weather.windSpeedKph}kph` : null,
        weather.uvIndex != null ? `UV index ${weather.uvIndex}` : null,
        weather.soilTemperatureC != null ? `soil temp ${weather.soilTemperatureC}°C` : null,
        weather.heatRisk ? "heat risk" : null,
        weather.frostRisk ? "frost risk" : null,
        weather.rainLikely ? "rain expected" : null,
        weather.highWind ? "high wind risk" : null,
        weather.climateZone ? `Climate zone: ${weather.climateZone}` : null,
        weather.hemisphere ? `Hemisphere: ${weather.hemisphere}` : null,
      ].filter(Boolean).join(", ")
    : "";

  const result = await requestOpenAIChat({
    messages: [
      {
        role: "system",
        content: "You are a plant care expert. Respond with a JSON object only, no prose.",
      },
      {
        role: "user",
        content: `Generate seasonal care recommendations for a ${gardenType} garden in ${location || "a temperate climate"} during ${season} ${year}.
${weatherSection ? weatherSection + "\n" : ""}Plants in this garden:
${plantList}

Tailor advice to the actual species listed and current weather. Focus on what needs attention this season given the health scores.

Return JSON:
{
  "tips": ["up to 5 actionable tips specific to this season and these plants"],
  "focusAreas": ["2-3 key focus areas (e.g. Watering, Pest control)"],
  "warning": "one critical seasonal warning or null"
}`,
      },
    ],
    maxTokens: 600,
  });

  let parsed: { tips?: string[]; focusAreas?: string[]; warning?: string | null } = {};
  try {
    parsed = JSON.parse(result.content ?? "{}");
  } catch { /* use defaults */ }

  const advice: SeasonalAdvice = {
    season,
    year,
    tips: parsed.tips ?? [],
    focusAreas: parsed.focusAreas ?? [],
    warning: parsed.warning ?? undefined,
    generatedAt: new Date().toISOString(),
  };

  await db.prepare(
    `INSERT INTO seasonal_recommendations (id, user_id, season, year, advice_json, generated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, season, year) DO UPDATE SET advice_json = excluded.advice_json, generated_at = excluded.generated_at`,
  ).run(randomUUID(), userId, season, year, JSON.stringify(advice), advice.generatedAt);

  return advice;
}
