import {
  buildAgentBrief,
  getGardenMetrics,
  readGardenState,
  type CareTask,
  type GardenState,
  type Plant,
} from "@/lib/garden";
import { readRecentDiagnosisRuns } from "@/lib/diagnosis";

export type DailyBriefToolResult = {
  garden: GardenState;
  plants: Plant[];
  openTasks: CareTask[];
  metrics: ReturnType<typeof getGardenMetrics>;
  brief: ReturnType<typeof buildAgentBrief>;
};

export async function getUserGarden() {
  return readGardenState();
}

export async function getPlantCollection() {
  const garden = await getUserGarden();
  return garden.plants;
}

export async function getOpenTasks() {
  const garden = await getUserGarden();
  return garden.tasks.filter((task) => task.status === "open");
}

export async function createDailyBrief() {
  const garden = await getUserGarden();

  return {
    garden,
    plants: garden.plants,
    openTasks: garden.tasks.filter((task) => task.status === "open"),
    metrics: getGardenMetrics(garden),
    brief: buildAgentBrief(garden),
  } satisfies DailyBriefToolResult;
}

export async function getDiagnosisHistory(limit = 5) {
  return readRecentDiagnosisRuns(limit);
}
