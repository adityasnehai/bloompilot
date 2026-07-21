import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/lib/api-session";
import { getCurrentWorkspaceUserId } from "@/lib/garden";
import { readGardenState } from "@/lib/garden";
import { createInitialStudioLayout, getStudioLayout, saveStudioLayout, type LayoutPlant } from "@/lib/studio-layout";
import { withApiHandler, parseJsonBody } from "@/lib/api-handler";

const VALID_TYPES = new Set(["balcony", "terrace", "indoor", "backyard"]);

const layoutSchema = z.object({
  gardenType: z.string().optional(),
  plants: z.array(z.unknown()),
});

// GET /api/garden-studio/layout?gardenType=balcony
export const GET = withApiHandler(async (request: Request) => {
  const { response } = await requireApiSession({ requireOnboarded: false });
  if (response) return response;

  const gardenType = new URL(request.url).searchParams.get("gardenType") ?? "balcony";
  if (!VALID_TYPES.has(gardenType)) {
    return NextResponse.json({ error: "Invalid gardenType" }, { status: 400 });
  }

  const userId = await getCurrentWorkspaceUserId();
  if (!userId) return NextResponse.json({ plants: [], gardenType }, { status: 200 });

  const layout = await getStudioLayout(userId, gardenType);
  if (layout) {
    return NextResponse.json({
      gardenType,
      plants: layout.plants,
      savedAt: layout.savedAt,
      source: "studio-layout",
    });
  }

  // A first visit should reflect the user's real garden, not a demo catalogue.
  // Seed only plants whose saved placement matches this studio environment.
  const initialPlants = createInitialStudioLayout((await readGardenState()).plants, gardenType);
  if (initialPlants.length > 0) {
    const savedAt = await saveStudioLayout(userId, gardenType, initialPlants);
    return NextResponse.json({
      gardenType,
      plants: initialPlants,
      savedAt,
      source: "saved-garden",
    });
  }

  return NextResponse.json({
    gardenType,
    plants: [],
    savedAt: null,
    source: "empty-garden",
  });
});

// POST /api/garden-studio/layout  — body: { gardenType, plants }
export const POST = withApiHandler(async (request: Request) => {
  const { response } = await requireApiSession({ requireOnboarded: false });
  if (response) return response;

  const userId = await getCurrentWorkspaceUserId();
  if (!userId) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const parsed = await parseJsonBody(request, layoutSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  const gardenType = body.gardenType ?? "balcony";

  if (!VALID_TYPES.has(gardenType)) {
    return NextResponse.json({ error: "Invalid gardenType" }, { status: 400 });
  }
  if (!Array.isArray(body.plants)) {
    return NextResponse.json({ error: "plants must be an array" }, { status: 400 });
  }
  if (body.plants.length > 100) {
    return NextResponse.json({ error: "A layout can contain at most 100 plants" }, { status: 400 });
  }

  // Validate + sanitise each plant entry
  const garden = await readGardenState();
  const ownedPlants = new Map(garden.plants.map((plant) => [plant.id, plant]));
  const dimensions = {
    balcony: { halfW: 5.5, halfD: 1.2 },
    terrace: { halfW: 6.5, halfD: 2 },
    indoor: { halfW: 3.8, halfD: 2.2 },
    backyard: { halfW: 6, halfD: 3.2 },
  }[gardenType as "balcony" | "terrace" | "indoor" | "backyard"];
  const seenPlantIds = new Set<string>();
  const plants: LayoutPlant[] = (body.plants as Record<string, unknown>[])
    .flatMap((p) => {
      if (typeof p !== "object" || p === null || typeof p.plantId !== "string") return [];
      const plant = ownedPlants.get(p.plantId);
      const x = Number(p.x);
      const z = Number(p.z);
      const waterDays = Number(p.waterDays ?? 7);
      const rotation = Number(p.rotation ?? 0);
      const lightReq = String(p.lightReq ?? "partial_shade");
      if (!plant || seenPlantIds.has(p.plantId) || !Number.isFinite(x) || !Number.isFinite(z) || !Number.isFinite(waterDays) || !Number.isFinite(rotation)) return [];
      if (Math.abs(x) > dimensions.halfW || Math.abs(z) > dimensions.halfD || waterDays < 1 || waterDays > 3650) return [];
      if (lightReq !== "full_sun" && lightReq !== "partial_shade" && lightReq !== "shade") return [];
      seenPlantIds.add(p.plantId);
      return [{
      plantId:    String(p.plantId    ?? ""),
      commonName: plant.nickname,
      species:    plant.species,
      imageUrl:   typeof p.imageUrl === "string" ? p.imageUrl : undefined,
      lightReq,
      waterDays,
      x,
      z,
      rotation,
    }];
    });

  if (plants.length !== body.plants.length) {
    return NextResponse.json({ error: "Layout contains an invalid or duplicate plant" }, { status: 400 });
  }

  const savedAt = await saveStudioLayout(userId, gardenType, plants);

  return NextResponse.json({ ok: true, saved: plants.length, savedAt });
});
