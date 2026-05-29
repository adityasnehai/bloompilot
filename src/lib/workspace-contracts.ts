import type { DiagnosisRun } from "@/lib/diagnosis";
import type { CareTask, GardenState, Plant } from "@/lib/garden";
import type { StoredAgentRun } from "@/lib/agent-runtime";
import type { StoredReminderRun } from "@/lib/reminders";

export type WorkspaceEnvelope = {
  generatedAt: string;
  garden: GardenState;
  latestAgentRun: StoredAgentRun | null;
  latestReminderRun: StoredReminderRun | null;
  diagnoses: DiagnosisRun[];
};

export type PlantsResponse = {
  plants: Plant[];
  garden: GardenState;
};

export type TasksResponse = {
  tasks: CareTask[];
  garden: GardenState;
};

export type MutationResponse = {
  ok: true;
  garden: GardenState;
};

export type PlantMutationResponse = MutationResponse & {
  plant: Plant | null;
};

export type TaskMutationResponse = MutationResponse & {
  task: CareTask | null;
};

export type AgentServiceStatusResponse = {
  enabled: boolean;
  mode: "local" | "external";
  url: string | null;
  endpoints: {
    health: string | null;
    brief: string | null;
    reminders: string | null;
    diagnosis: string | null;
  };
};
