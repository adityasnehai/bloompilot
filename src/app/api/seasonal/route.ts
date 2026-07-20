import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/api-session";
import { getClimateZone } from "@/lib/context-builder";
import { readWorkspaceIdentityByEmail } from "@/lib/workspace-store";
import {
  generateSeasonalRecommendations,
  getStoredSeasonalRecommendations,
} from "@/lib/seasonal-recommendations";
import { getDatabase } from "@/lib/database";
import { readWeatherSnapshot } from "@/lib/weather";
import { getGardenHealthHistory } from "@/lib/plant-memory";

export const runtime = "nodejs";

export async function GET() {
  const { session, response } = await requireApiSession();
  if (!session || response) return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const identity = await readWorkspaceIdentityByEmail(session.email);
  if (!identity) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const stored = await getStoredSeasonalRecommendations(identity.id);
  if (stored) return NextResponse.json({ advice: stored, cached: true });

  return NextResponse.json({ advice: null, cached: false });
}

export async function POST() {
  const { session, response } = await requireApiSession();
  if (!session || response) return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const identity = await readWorkspaceIdentityByEmail(session.email);
  if (!identity) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const db = await getDatabase();

  type UserRow = { garden_type: string; location: string; latitude: number | null; longitude: number | null };
  const userRow = await db
    .prepare(`SELECT garden_type, location, latitude, longitude FROM users WHERE id = ?`)
    .get(identity.id) as UserRow | undefined;

  type PlantRow = { id: string; nickname: string; species: string };
  const plantRows = await db
    .prepare(`SELECT id, nickname, species FROM plants WHERE user_id = ? LIMIT 15`)
    .all(identity.id) as PlantRow[];

  // Build health score map from recent events
  const healthEvents = await getGardenHealthHistory(identity.id, 100);
  const healthScoreByPlant = new Map<string, number>();
  const diagnosedPlants = new Set<string>();
  for (const event of healthEvents) {
    if (event.eventType === "diagnosed") {
      diagnosedPlants.add(event.plantId);
    }
  }
  // Plants with recent diagnoses get lower health scores
  for (const event of healthEvents) {
    if (!healthScoreByPlant.has(event.plantId)) {
      healthScoreByPlant.set(event.plantId, diagnosedPlants.has(event.plantId) ? 55 : 80);
    }
  }

  const plants = plantRows.map((p) => ({
    nickname: p.nickname,
    species: p.species || null,
    healthScore: healthScoreByPlant.get(p.id) ?? null,
  }));

  // Fetch weather if coordinates available
  const weatherResult = await (userRow?.latitude && userRow?.longitude
    ? readWeatherSnapshot(userRow.latitude, userRow.longitude).catch(() => null)
    : Promise.resolve(null));

  const lat = userRow?.latitude ?? null;
  const lon = userRow?.longitude ?? null;

  const weather = weatherResult
    ? {
        temperatureC: weatherResult.temperatureC,
        humidity: weatherResult.humidity,
        windSpeedKph: weatherResult.windSpeedKph,
        uvIndex: weatherResult.uvIndex,
        soilTemperatureC: weatherResult.soilTemperatureC,
        heatRisk: weatherResult.heatRisk,
        frostRisk: weatherResult.frostRisk,
        rainLikely: weatherResult.rainLikely,
        highWind: (weatherResult.windSpeedKph ?? 0) >= 40,
        climateZone: lat !== null ? getClimateZone(lat, lon) : null,
        hemisphere: lat !== null ? (lat >= 0 ? "northern" as const : "southern" as const) : undefined,
      }
    : null;

  let advice;
  try {
    advice = await generateSeasonalRecommendations(
      identity.id,
      userRow?.garden_type ?? "mixed",
      userRow?.location ?? "",
      plants,
      weather,
    );
  } catch {
    return NextResponse.json({ error: "Seasonal recommendations service unavailable" }, { status: 503 });
  }

  return NextResponse.json({ advice, cached: false });
}
