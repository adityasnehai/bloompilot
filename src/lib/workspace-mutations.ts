import {
  addPlantToGarden,
  getCurrentWorkspaceUserId,
  normalizePlacement,
  placementOptions,
  readGardenState,
  removePlantFromGarden,
  sunlightOptions,
  toggleTaskStatus,
  updatePlantInGarden,
  type Plant,
  type PlantInput,
  type PlantPlacement,
  type SunlightLevel,
  writeGardenState,
} from "@/lib/garden";
import { clearWorkspaceDerivedCareData } from "@/lib/workspace-store";
import { logHealthEvent, type HealthEventType } from "@/lib/plant-memory";
import { getDatabase } from "@/lib/database";

async function cleanupPlantOrphans(userId: number, plantId: string) {
  const db = await getDatabase();
  const tables = [
    "diagnosis_runs",
    "plant_alerts",
    "plant_health_events",
    "plant_milestones",
    "plant_notes",
    "plant_evidence",
  ];
  for (const table of tables) {
    await db.prepare(`DELETE FROM ${table} WHERE user_id = ? AND plant_id = ?`).run(userId, plantId);
  }
  await db.prepare(`DELETE FROM action_feedback WHERE user_id = ? AND plant_id = ?`).run(userId, plantId);
}

function parsePlacement(value: unknown): PlantPlacement {
  if (placementOptions.includes(value as PlantPlacement)) {
    return value as PlantPlacement;
  }

  return normalizePlacement(typeof value === "string" ? value : "");
}

function parseSunlight(value: unknown): SunlightLevel {
  return sunlightOptions.includes(value as SunlightLevel)
    ? (value as SunlightLevel)
    : "Bright indirect";
}

function normalizePlantName(value: string) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/(^|\s)\S/g, (char) => char.toUpperCase());
}

export function coercePlantInput(input: Record<string, unknown>): PlantInput | null {
  const nickname =
    typeof input.nickname === "string" ? normalizePlantName(input.nickname) : "";
  const rawSpecies = typeof input.species === "string" ? input.species.trim() : "";
  const species = rawSpecies;
  const notes = typeof input.notes === "string" ? input.notes.trim() : "";
  const rawInterval =
    typeof input.wateringIntervalDays === "number"
      ? input.wateringIntervalDays
      : typeof input.wateringIntervalDays === "string"
        ? Number(input.wateringIntervalDays)
        : Number.NaN;

  if (
    !nickname ||
    nickname.length > 120 ||
    !species ||
    species.length > 200 ||
    species.toLowerCase().includes("unknown") ||
    !Number.isInteger(rawInterval) ||
    rawInterval < 1 ||
    rawInterval > 3650 ||
    notes.length > 2000
  ) {
    return null;
  }

  return {
    nickname,
    species,
    placement: parsePlacement(input.placement),
    sunlight: parseSunlight(input.sunlight),
    wateringIntervalDays: rawInterval,
    notes,
  };
}

function findInsertedPlant(previous: Plant[], next: Plant[]) {
  const previousIds = new Set(previous.map((plant) => plant.id));
  return next.find((plant) => !previousIds.has(plant.id)) ?? null;
}

export async function addPlantMutation(input: PlantInput) {
  const userId = await getCurrentWorkspaceUserId();
  const gardenState = await readGardenState();
  const nextState = addPlantToGarden(gardenState, input);

  await writeGardenState(nextState);
  if (userId) await clearWorkspaceDerivedCareData(userId);

  return {
    garden: nextState,
    plant: findInsertedPlant(gardenState.plants, nextState.plants),
  };
}

export async function updatePlantMutation(plantId: string, input: PlantInput) {
  const userId = await getCurrentWorkspaceUserId();
  const gardenState = await readGardenState();
  const result = updatePlantInGarden(gardenState, plantId, input);

  if (!result.plant) {
    return {
      garden: gardenState,
      plant: null,
    };
  }

  await writeGardenState(result.state);
  if (userId) await clearWorkspaceDerivedCareData(userId);

  return {
    garden: result.state,
    plant: result.plant,
  };
}

export async function removePlantMutation(plantId: string) {
  const userId = await getCurrentWorkspaceUserId();
  const gardenState = await readGardenState();
  const plant = gardenState.plants.find((entry) => entry.id === plantId) ?? null;

  if (!plant) {
    return {
      garden: gardenState,
      plant: null,
    };
  }

  const nextState = removePlantFromGarden(gardenState, plantId);

  await writeGardenState(nextState);
  if (userId) {
    await cleanupPlantOrphans(userId, plantId);
    await clearWorkspaceDerivedCareData(userId);
  }

  return {
    garden: nextState,
    plant,
  };
}

export async function toggleTaskMutation(taskId: string) {
  const gardenState = await readGardenState();

  const prevTask = gardenState.tasks.find((t) => t.id === taskId);
  const plant = prevTask
    ? gardenState.plants.find((p) => p.id === prevTask.plantId)
    : null;

  const nextState = toggleTaskStatus(gardenState, taskId);

  await writeGardenState(nextState);

  if (prevTask && plant) {
    const userId = await getCurrentWorkspaceUserId();
    if (userId) {
      const completing = prevTask.status === "open";
      const eventTypeMap: Partial<Record<string, HealthEventType>> = {
        water: "watered",
        inspect: "inspected",
        feed: "fertilized",
      };
      const eventType = eventTypeMap[prevTask.kind];
      if (completing && eventType) {
        await logHealthEvent(
          userId,
          plant.id,
          plant.nickname,
          eventType,
          completing
            ? `${prevTask.title} marked complete`
            : `${prevTask.title} reopened`,
          { taskId: prevTask.id, kind: prevTask.kind, dueDate: prevTask.dueDate },
        );
      }
    }
  }

  return {
    garden: nextState,
    task: nextState.tasks.find((entry) => entry.id === taskId) ?? null,
  };
}
