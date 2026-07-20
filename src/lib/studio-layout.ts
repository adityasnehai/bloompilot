import { getDatabase } from "@/lib/database";
import type { Plant } from "@/lib/garden";

export type LayoutPlant = {
  plantId: string;
  commonName: string;
  species: string;
  imageUrl?: string;
  lightReq: string;
  waterDays: number;
  x: number;
  z: number;
  rotation: number;
};

export type StudioLayout = {
  gardenType: string;
  plants: LayoutPlant[];
  savedAt: string;
};

type LayoutRow = {
  user_id: number;
  garden_type: string;
  layout_json: string;
  updated_at: string;
};

const VALID_LIGHT_TARGETS = new Set(["full_sun", "partial_shade", "shade"]);

const DIMENSIONS: Record<string, { halfW: number; halfD: number }> = {
  balcony: { halfW: 5.5, halfD: 1.2 },
  terrace: { halfW: 6.5, halfD: 2 },
  indoor: { halfW: 3.8, halfD: 2.2 },
  backyard: { halfW: 6, halfD: 3.2 },
};

function lightTarget(sunlight: string): "full_sun" | "partial_shade" | "shade" {
  if (sunlight === "Full sun") return "full_sun";
  if (sunlight === "Low light") return "shade";
  return "partial_shade";
}

function stableRotation(value: string) {
  let hash = 0;
  for (const char of value) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  return ((Math.abs(hash) % 360) - 180) * (Math.PI / 180) * 0.08;
}

/** Builds a first layout from saved plants only. It does not invent plants or claim measured exposure. */
export function createInitialStudioLayout(plants: Plant[], gardenType: string): LayoutPlant[] {
  const dimensions = DIMENSIONS[gardenType] ?? DIMENSIONS.balcony;
  const relevant = plants.filter((plant) => {
    const placement = plant.placement.toLowerCase();
    if (gardenType === "indoor") return placement === "indoor" || placement === "indoor collection";
    if (gardenType === "balcony") return placement === "balcony" || placement === "balcony garden" || placement.includes("patio") || placement === "patio";
    if (gardenType === "terrace") return placement === "terrace" || placement === "terrace garden";
    return placement === "backyard" || placement === "backyard garden";
  });
  const groups: Record<"full_sun" | "partial_shade" | "shade", Plant[]> = {
    full_sun: [], partial_shade: [], shade: [],
  };
  relevant.forEach((plant) => groups[lightTarget(plant.sunlight)].push(plant));
  const bandCenter: Record<string, number> = {
    full_sun: gardenType === "indoor" ? -(dimensions.halfD - 0.36) : dimensions.halfD - 0.36,
    partial_shade: 0,
    shade: gardenType === "indoor" ? dimensions.halfD - 0.3 : -(dimensions.halfD - 0.3),
  };
  const result: LayoutPlant[] = [];
  (Object.keys(groups) as Array<keyof typeof groups>).forEach((band) => {
    const group = groups[band];
    const span = Math.min(dimensions.halfW * 1.7, Math.max(0, (group.length - 1) * 1.05));
    group.forEach((plant, index) => {
      const x = group.length <= 1 ? 0 : -span / 2 + (span * index) / (group.length - 1);
      result.push({
        plantId: plant.id,
        commonName: plant.nickname,
        species: plant.species,
        imageUrl: plant.imageUrl,
        lightReq: band,
        waterDays: plant.wateringIntervalDays,
        x: Math.max(-dimensions.halfW + 0.62, Math.min(dimensions.halfW - 0.62, x)),
        z: bandCenter[band],
        rotation: stableRotation(`${plant.id}:${plant.species}`),
      });
    });
  });
  return result;
}

function isLayoutPlant(value: unknown): value is LayoutPlant {
  if (!value || typeof value !== "object") return false;
  const plant = value as Record<string, unknown>;
  return typeof plant.plantId === "string"
    && plant.plantId.length > 0
    && typeof plant.commonName === "string"
    && typeof plant.species === "string"
    && typeof plant.lightReq === "string"
    && VALID_LIGHT_TARGETS.has(plant.lightReq)
    && Number.isFinite(plant.waterDays)
    && Number(plant.waterDays) >= 1
    && Number(plant.waterDays) <= 3650
    && Number.isFinite(plant.x)
    && Number.isFinite(plant.z)
    && Number.isFinite(plant.rotation)
    && (plant.imageUrl === undefined || typeof plant.imageUrl === "string");
}

export async function getStudioLayout(userId: number, gardenType: string): Promise<StudioLayout | null> {
  const db = await getDatabase();
  const row = await db
    .prepare(
      `SELECT layout_json, garden_type, updated_at
       FROM studio_layouts WHERE user_id = ? AND garden_type = ?`,
    )
    .get(userId, gardenType) as Pick<LayoutRow, "layout_json" | "garden_type" | "updated_at"> | undefined;

  if (!row) return null;
  try {
    const parsed = JSON.parse(row.layout_json) as unknown;
    if (!Array.isArray(parsed) || parsed.length > 100 || !parsed.every(isLayoutPlant)) return null;
    const plants = parsed;
    return { gardenType: row.garden_type, plants, savedAt: row.updated_at };
  } catch {
    return null;
  }
}

export async function saveStudioLayout(
  userId: number,
  gardenType: string,
  plants: LayoutPlant[],
): Promise<string> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.prepare(
    `INSERT INTO studio_layouts (user_id, garden_type, layout_json, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (user_id, garden_type) DO UPDATE
       SET layout_json = excluded.layout_json,
           updated_at  = excluded.updated_at`,
  ).run(userId, gardenType, JSON.stringify(plants), now);
  return now;
}

/** Returns the user-facing planning band for a z-position and garden type.
 *  Used to pass the saved Studio choice to the care planner without claiming measured exposure.
 */
export function studioZoneAt(
  z: number,
  gardenType: string,
): "full_sun" | "partial_shade" | "shade" {
  const halfD: Record<string, number> = {
    balcony: 1.2,
    terrace: 2.0,
    indoor:  2.2,
    backyard: 3.2,
  };
  const hd = halfD[gardenType] ?? 1.2;

  // These are user-facing planning bands, not measured or simulated exposure.
  const fullFrac = 1 / 3;
  const partialFrac = 2 / 3;
  const fromLightSide = gardenType === "indoor"
    ? (hd + z) / (hd * 2)
    : (hd - z) / (hd * 2);

  if (fromLightSide <= fullFrac) return "full_sun";
  if (fromLightSide <= partialFrac) return "partial_shade";
  return "shade";
}
