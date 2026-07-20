import { NextResponse } from "next/server";
import {
  buildGardenContext,
  isGardenContextSnapshotStale,
  readLatestContextSnapshot,
  type ContextJson,
} from "@/lib/context-builder";
import { requireApiSession } from "@/lib/api-session";
import { readWorkspaceIdentityByEmail } from "@/lib/workspace-store";

type DashboardPayload = {
  garden_summary: {
    location: string;
    garden_type: string;
    plant_count: number;
    reminder_window: string;
    notification_channels: string[];
  };
  environment_summary: ContextJson["environment"];
  plants_summary: ContextJson["plants"];
  evidence_readiness: {
    location_data: boolean;
    weather_data: boolean;
    plant_species: boolean;
    plant_care_knowledge: boolean;
    user_environment_inputs: boolean;
  };
  next_action: {
    type: "generate_care_plan" | "fix_missing_data";
    label: string;
  };
  context_id: string;
  generated_at: string;
  warnings: ContextJson["warnings"];
  agent_ready: boolean;
};

function buildDashboardPayload(context: ContextJson): DashboardPayload {
  const hasPlants = context.plants.length > 0;
  const allPlantKnowledgeAvailable =
    hasPlants &&
    context.plants.every(
      (plant) =>
        Boolean(plant.plant_knowledge.watering_baseline) &&
        Boolean(plant.plant_knowledge.sunlight_preference) &&
        Boolean(plant.plant_knowledge.soil_preference),
    );
  const allSpeciesAvailable =
    hasPlants && context.plants.every((plant) => Boolean(plant.species));
  const allUserInputsAvailable =
    hasPlants &&
    context.plants.every(
      (plant) =>
        Boolean(plant.placement) &&
        Boolean(plant.sunlight.label) &&
        Boolean(plant.soil.type) &&
        Boolean(plant.watering.mode),
    );

  return {
    garden_summary: {
      location: context.garden.location.input,
      garden_type: context.garden.garden_type,
      plant_count: context.plants.length,
      reminder_window: context.user.notification_preference.time_window,
      notification_channels: context.user.notification_preference.channels,
    },
    environment_summary: context.environment,
    plants_summary: context.plants,
    evidence_readiness: {
      location_data:
        context.garden.location.lat !== null && context.garden.location.lon !== null,
      weather_data: context.environment.temperature_c !== null,
      plant_species: allSpeciesAvailable,
      plant_care_knowledge: allPlantKnowledgeAvailable,
      user_environment_inputs: allUserInputsAvailable,
    },
    next_action: context.agent_ready
      ? {
          type: "generate_care_plan",
          label: "Generate Care Plan",
        }
      : {
          type: "fix_missing_data",
          label: "Fix Missing Data",
        },
    context_id: context.context_id,
    generated_at: context.generated_at,
    warnings: context.warnings,
    agent_ready: context.agent_ready,
  };
}

export async function GET() {
  const { session, response } = await requireApiSession();

  if (response) {
    return response;
  }

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const identity = await readWorkspaceIdentityByEmail(session.email);

  if (!identity) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  let context = await readLatestContextSnapshot(identity.id);
  if (isGardenContextSnapshotStale(context)) {
    context = await buildGardenContext(identity.id);
  }

  if (!context) {
    return NextResponse.json({ error: "Context build failed" }, { status: 500 });
  }

  return NextResponse.json(buildDashboardPayload(context));
}
