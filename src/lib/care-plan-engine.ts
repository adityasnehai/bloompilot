import { getDatabase, withTransaction } from "@/lib/database";
import type { ContextJson } from "@/lib/context-builder";
import { isReminderWindowActive } from "@/lib/reminder-window";

export type AgentTrace = {
  id: string;
  agent_name: string;
  status: "success" | "warning" | "error";
  input_summary: string;
  output_summary: string;
  evidence: EvidenceRef[];
  created_at: string;
};

export type CarePriority = "high" | "medium" | "low";
export type CareActionType =
  | "water"
  | "skip_water"
  | "move"
  | "shade"
  | "protect"
  | "inspect"
  | "fertilize"
  | "prune"
  | "identify"
  | "drainage"
  | "disease_watch";

export type EvidenceRef = {
  type: string;
  source: string;
  supports: string;
};

export type CarePlanAction = {
  id: string;
  plant_id: string | null;
  plant_name: string;
  type: CareActionType;
  title: string;
  priority: CarePriority;
  due_date: string;
  reason: string;
  evidence_refs: EvidenceRef[];
  source_agents: string[];
  status: "approved" | "rejected";
  confidence: number;
  rejection_reason?: string;
};

export type PlantCarePlan = {
  plant_id: string;
  plant_name: string;
  species: string | null;
  readiness: "ready" | "needs_identification" | "needs_care_data";
  watering_interval_days: number | null;
  watering_reason: string;
  skip_or_delay_rule: string;
  sunlight_requirement: string;
  placement_advice: string;
  soil_drainage_advice: string;
  fertilizer_cadence: string;
  pruning_cleaning_cadence: string;
  pest_inspection_cadence: string;
  disease_warning_triggers: string[];
  climate_protection_rule: string;
  confidence: number;
  evidence_status: "complete" | "partial";
};

export type WeatherRiskSummary = {
  heat_stress: boolean;
  frost_risk: boolean;
  heavy_rain: boolean;
  high_uv: boolean;
  humidity_stress: boolean;
  source: string;
};

export type WateringForecastDay = {
  date: string;
  should_water: boolean;
  label: "water" | "skip" | "check";
  reason: string;
};

export type PlantWateringForecast = {
  plant_id: string;
  plant_name: string;
  interval_days: number | null;
  days: WateringForecastDay[];
};

export type WeatherRiskForecastDay = {
  date: string;
  heat_stress: boolean;
  frost_risk: boolean;
  heavy_rain: boolean;
  high_uv: boolean;
  humidity_stress: boolean;
  risk_count: number;
};

export type CareCalendarGroup = {
  label: "Today" | "Tomorrow" | "This week";
  date_range: string;
  tasks: CarePlanAction[];
};

export type PlantSetupMismatch = {
  plant_id: string;
  plant_name: string;
  type: "soil" | "sunlight" | "placement" | "identity";
  severity: CarePriority;
  current: string;
  expected: string;
  recommendation: string;
  evidence_refs: EvidenceRef[];
};

export type ReminderReadinessItem = {
  action_id: string;
  title: string;
  plant_name: string;
  due_date: string;
  channels: string[];
  reminder_window: string;
  window_active: boolean;
  ready: boolean;
  blocker: string | null;
};

export type PlantWaterBalance = {
  plant_id: string;
  plant_name: string;
  et0_mm: number | null;
  rain_mm: number | null;
  soil_moisture_ratio: number | null;
  net_need_score: number;
  status: "low_need" | "moderate_need" | "high_need";
};

export type RiskHorizon = {
  window_days: 3 | 7;
  heat_stress_days: number;
  frost_risk_days: number;
  heavy_rain_days: number;
  high_uv_days: number;
};

export type CareAdherence = {
  weekly_due: number;
  weekly_completed: number;
  weekly_completion_rate: number;
  by_plant: Array<{
    plant_id: string;
    plant_name: string;
    due: number;
    completed: number;
    completion_rate: number;
  }>;
};

export type OutcomeTracking = {
  total_diagnoses: number;
  symptom_recurrence_rate: number;
  before_after_effectiveness: number;
};

export type RecommendationConfidence = {
  action_id: string;
  plant_name: string;
  confidence_score: number;
  factors: {
    identity: boolean;
    weather: boolean;
    care_knowledge: boolean;
  };
};

export type CarePlanOutput = {
  id: string;
  context_id: string;
  agent_run_id: string;
  generated_at: string;
  status: "ready" | "partial";
  summary: {
    health_score: number;
    health_band: string;
    total_plants: number;
    identified_plants: number;
    active_risks: number;
    ready_for_reminders: boolean;
  };
  today_actions: CarePlanAction[];
  upcoming_tasks: CarePlanAction[];
  plant_plans: PlantCarePlan[];
  weather_risks: WeatherRiskSummary;
  health_readiness: {
    location_ready: boolean;
    weather_ready: boolean;
    plant_species_ready: boolean;
    plant_knowledge_ready: boolean;
  };
  evidence_sources: EvidenceRef[];
  rejected_actions: CarePlanAction[];
  agent_traces: AgentTrace[];
  watering_forecast: PlantWateringForecast[];
  weather_risk_forecast: WeatherRiskForecastDay[];
  care_calendar: CareCalendarGroup[];
  setup_mismatches: PlantSetupMismatch[];
  reminder_readiness: ReminderReadinessItem[];
  water_balance: PlantWaterBalance[];
  risk_horizon: RiskHorizon[];
  care_adherence: CareAdherence;
  outcome_tracking: OutcomeTracking;
  recommendation_confidence: RecommendationConfidence[];
};

type CarePlanRow = {
  plan_json: string;
};

type TaskAdherenceRow = {
  plant_id: string;
  due_count: number;
  completed_count: number;
};

type DiagnosisRow = {
  plant_id: string;
  plant_nickname: string;
  category: string;
  evidence_status: "confirmed" | "needs_more_evidence";
  issue: string;
  severity: "low" | "medium" | "high";
  created_at: string;
};

function addDays(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function containsSuppressedDiagnosisText(value: string | null | undefined) {
  const text = value?.toLowerCase().trim() ?? "";
  return text.includes("provider unavailable") || text.includes("needs more evidence");
}

function shouldKeepCarePlanAction(action: CarePlanAction) {
  const actionText = [
    action.title,
    action.reason,
    ...action.evidence_refs.map((ref) => `${ref.source} ${ref.supports}`),
  ].join(" ");

  return !containsSuppressedDiagnosisText(actionText);
}

function careActionKey(action: Pick<CarePlanAction, "plant_id" | "type" | "due_date">) {
  return `${action.plant_id ?? "garden"}|${action.type}|${action.due_date}`;
}

function dedupeCareActions(actions: CarePlanAction[]) {
  const seen = new Set<string>();
  return actions.filter((action) => {
    const key = careActionKey(action);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sanitizeActionList(actions: CarePlanAction[]) {
  return dedupeCareActions(actions.filter(shouldKeepCarePlanAction));
}

function sanitizeCarePlanOutput(plan: CarePlanOutput) {
  const todayActions = sanitizeActionList(plan.today_actions);
  const upcomingTasks = sanitizeActionList(plan.upcoming_tasks);
  const rejectedActions = sanitizeActionList(plan.rejected_actions);
  const careCalendar = plan.care_calendar
    .map((group) => ({
      ...group,
      tasks: sanitizeActionList(group.tasks),
    }))
    .filter((group) => group.tasks.length > 0);
  const taskIds = new Set([
    ...todayActions.map((action) => action.id),
    ...upcomingTasks.map((action) => action.id),
    ...careCalendar.flatMap((group) => group.tasks.map((action) => action.id)),
  ]);

  return {
    ...plan,
    today_actions: todayActions,
    upcoming_tasks: upcomingTasks,
    rejected_actions: rejectedActions,
    care_calendar: careCalendar,
    reminder_readiness: plan.reminder_readiness.filter((item) => taskIds.has(item.action_id)),
    recommendation_confidence: plan.recommendation_confidence.filter((item) =>
      taskIds.has(item.action_id),
    ),
  } satisfies CarePlanOutput;
}

export function isCarePlanReasoningStale(plan: CarePlanOutput | null) {
  if (!plan) return true;

  const plannerActions = [...plan.today_actions, ...plan.upcoming_tasks].filter((action) =>
    action.source_agents.includes("ReAct Care Planner"),
  );

  return plannerActions.some((action) =>
    !action.evidence_refs.some((entry) => entry.source === "BloomPilot context builder"),
  );
}

function getDailyForecast(context: ContextJson) {
  return Array.isArray(context.environment.daily_forecast)
    ? context.environment.daily_forecast
    : [];
}

function toTitle(value: string) {
  return value
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .split(" ")
    .filter(Boolean)
    .map((entry) => entry.charAt(0).toUpperCase() + entry.slice(1))
    .join(" ");
}

export function hasPlantCareKnowledge(plant: ContextJson["plants"][number] | undefined) {
  return Boolean(
    plant?.plant_knowledge.watering_baseline &&
      plant.plant_knowledge.sunlight_preference &&
      plant.plant_knowledge.soil_preference,
  );
}

export function getReadiness(context: ContextJson) {
  return {
    location_ready:
      context.garden.location.lat !== null && context.garden.location.lon !== null,
    weather_ready: context.environment.temperature_c !== null,
    plant_species_ready:
      context.plants.length > 0 &&
      context.plants.every((plant) => Boolean(plant.species)),
    plant_knowledge_ready:
      context.plants.length > 0 &&
      context.plants.every((plant) => hasPlantCareKnowledge(plant)),
  };
}

export function getWeatherRisks(context: ContextJson): WeatherRiskSummary {
  const humidity = context.environment.humidity_percent;
  return {
    heat_stress: context.environment.risk_flags.heat_stress,
    frost_risk: context.environment.risk_flags.frost_risk,
    heavy_rain: context.environment.risk_flags.heavy_rain,
    high_uv: context.environment.risk_flags.high_uv,
    humidity_stress: humidity !== null && (humidity <= 35 || humidity >= 85),
    source: context.environment.weather_source,
  };
}

export function getRiskCount(context: ContextJson) {
  return Object.entries(getWeatherRisks(context))
    .filter(([key]) => key !== "source")
    .map(([, value]) => value)
    .filter(Boolean).length;
}

export function getHealthScore(context: ContextJson) {
  const readiness = getReadiness(context);
  let score = 100;
  if (!readiness.location_ready) score -= 18;
  if (!readiness.weather_ready) score -= 18;
  if (!readiness.plant_species_ready) score -= 20;
  if (!readiness.plant_knowledge_ready) score -= 12;
  score -= Math.min(getRiskCount(context) * 6, 24);
  return Math.max(0, Math.min(100, score));
}

export function getHealthBand(score: number) {
  if (score >= 85) return "excellent";
  if (score >= 70) return "good";
  if (score >= 50) return "needs_attention";
  return "high_risk";
}

export function getSuggestedWateringDays(
  plant: ContextJson["plants"][number],
  context: ContextJson,
) {
  if (plant.watering.mode === "custom" && plant.watering.custom_interval_days) {
    return plant.watering.custom_interval_days;
  }

  let days = 5;
  if (plant.soil.type === "sandy") days -= 1;
  if (plant.soil.type === "clay") days += 1;
  if (plant.pot_profile.size === "small") days -= 1;
  if (plant.pot_profile.size === "large") days += 1;
  if (plant.pot_profile.material === "terracotta" || plant.pot_profile.material === "fabric") days -= 1;
  if (!plant.pot_profile.drainage_holes) days += 2;
  if (plant.pot_profile.substrate_mix === "high_organic") days += 1;
  if (plant.pot_profile.substrate_mix === "high_mineral") days -= 1;
  if (plant.sunlight.label === "full_sun") days -= 1;
  if (plant.sunlight.label === "low_light") days += 1;
  if (context.environment.risk_flags.heat_stress) days -= 1;
  if ((context.environment.humidity_percent ?? 55) <= 40) days -= 1;
  if (context.environment.risk_flags.heavy_rain) days += 2;
  // Weather-adaptive soil moisture modifiers
  const sm = context.environment.soil_moisture ?? 0.4;
  if (sm > 0.65) days += 2;        // very wet — delay significantly
  else if (sm >= 0.42) days += 1;  // moderately wet
  else if (sm < 0.22) days -= 1;   // critically dry — water sooner
  // High evapotranspiration means plants lose water faster
  if ((context.environment.evapotranspiration_mm ?? 0) > 5) days -= 1;
  return Math.max(2, Math.min(14, days));
}

function buildEvidenceRefs(
  context: ContextJson,
  types: Array<"weather" | "plant_identity" | "plant_knowledge" | "user_input">,
  plant?: ContextJson["plants"][number],
) {
  const refs: EvidenceRef[] = [];

  if (types.includes("weather") && context.environment.temperature_c !== null) {
    refs.push({
      type: "weather",
      source: "Open-Meteo Forecast API",
      supports: "temperature, humidity, rainfall, UV, soil moisture and weather risk flags",
    });
  }

  if (types.includes("plant_identity")) {
    refs.push({
      type: "plant_identity",
      source: plant?.source === "image" ? "PlantNet API" : "iNaturalist or GBIF plant search",
      supports: "common name and species identity",
    });
  }

  if (types.includes("plant_knowledge")) {
    refs.push({
      type: "plant_knowledge",
      source: plant?.plant_knowledge.source ?? "local_rulebook_v1",
      supports: "baseline watering, sunlight, soil, temperature and humidity preferences",
    });
  }

  if (types.includes("user_input")) {
    refs.push({
      type: "user_input",
      source: "BloomPilot plant setup",
      supports: "placement, sunlight, soil and watering mode selected by the user",
    });
  }

  return refs;
}

export function buildPlantCarePlans(context: ContextJson): PlantCarePlan[] {
  return context.plants.map((plant) => {
    const careKnowledgeReady = hasPlantCareKnowledge(plant);
    const wateringDays = plant.species && careKnowledgeReady ? getSuggestedWateringDays(plant, context) : null;
    const risk = getWeatherRisks(context);
    const weatherSignals = [
      context.environment.rainfall_mm !== null ? "rainfall" : null,
      context.environment.humidity_percent !== null ? "humidity" : null,
      context.environment.evapotranspiration_mm !== null ? "ET0" : null,
      context.environment.soil_moisture !== null ? "soil moisture" : null,
    ].filter(Boolean);
    const climateRules = [
      risk.heat_stress ? "use morning watering and avoid fertilizer during heat stress" : "",
      risk.frost_risk ? "move containers indoors or cover exposed plants overnight" : "",
      risk.heavy_rain ? "protect containers from excess rain and check drainage" : "",
      risk.high_uv && plant.sunlight.label !== "full_sun"
        ? "move to filtered shade during peak UV"
        : "",
    ].filter(Boolean);

    return {
      plant_id: plant.plant_id,
      plant_name: plant.common_name,
      species: plant.species,
      readiness: !plant.species
        ? "needs_identification"
        : careKnowledgeReady
          ? "ready"
          : "needs_care_data",
      watering_interval_days: wateringDays,
      watering_reason: !plant.species
        ? "Species is missing, so plant-specific watering guidance is blocked."
        : !careKnowledgeReady
          ? "Plant care baseline is unavailable, so watering interval is blocked until provider data is available."
          : `Check top 3-5 cm of soil and water when dry. Cadence is tuned using ${toTitle(plant.soil.type)} soil, ${toTitle(plant.sunlight.label)} light${weatherSignals.length ? `, ${weatherSignals.join(", ")}` : ""}.`,
      skip_or_delay_rule:
        context.environment.temperature_c === null
          ? "Delay watering when top soil still feels wet. Weather-based skip rules need local weather data."
          : "Delay watering when rainfall is high, soil moisture is high, or top soil still feels wet.",
      sunlight_requirement:
        careKnowledgeReady
          ? plant.plant_knowledge.sunlight_preference ?? plant.sunlight.label
          : "Needs plant care data",
      placement_advice:
        !careKnowledgeReady
          ? "Confirm plant care baseline before changing placement."
          : plant.sunlight.label === "full_sun"
          ? `Keep ${plant.common_name} in the brightest available ${plant.placement} placement.`
          : `Keep ${plant.common_name} in ${plant.placement} with ${toTitle(plant.sunlight.label)} exposure.`,
      soil_drainage_advice: `Use ${toTitle(plant.soil.type)} soil with ${plant.soil.drainage} drainage; verify water drains freely after irrigation.`,
      fertilizer_cadence:
        careKnowledgeReady
          ? "Feed lightly every 4-6 weeks during active growth; pause during heat, frost or heavy-rain stress."
          : "Blocked until plant care baseline is available.",
      pruning_cleaning_cadence:
        careKnowledgeReady
          ? "Remove dead or yellowing leaves weekly; avoid heavy pruning during weather stress."
          : "Blocked until plant care baseline is available.",
      pest_inspection_cadence:
        "Inspect leaves, stems and soil line weekly; increase inspection after heat or humidity stress.",
      disease_warning_triggers: [
        "spreading leaf spots",
        "wilting after watering",
        "sticky residue or visible pests",
        "soft stems or foul soil smell",
      ],
      climate_protection_rule:
        climateRules.length > 0
          ? climateRules.join("; ")
          : "No active climate protection action is required from current weather flags.",
      confidence:
        plant.species && careKnowledgeReady
          ? (plant.plant_knowledge.source === "perenual_api" ? 0.9 : 0.78)
          : 0.45,
      evidence_status: plant.species && careKnowledgeReady ? "complete" : "partial",
    };
  });
}

export function buildRawCareActions(context: ContextJson): CarePlanAction[] {
  const actions: CarePlanAction[] = [];
  const today = addDays(0);

  if (context.plants.length === 0) {
    return actions;
  }

  for (const plant of context.plants) {
    if (!plant.species) {
      actions.push({
        id: crypto.randomUUID(),
        plant_id: plant.plant_id,
        plant_name: plant.common_name,
        type: "identify",
        title: "Add missing species data",
        priority: "high",
        due_date: today,
        reason: "Species is required before plant-specific care can be fully trusted.",
        evidence_refs: buildEvidenceRefs(context, ["plant_identity"], plant),
        source_agents: ["Plant Knowledge Agent", "Evidence Agent"],
        status: "approved",
        confidence: 0.45,
      });
      continue;
    }

    if (!hasPlantCareKnowledge(plant)) {
      actions.push({
        id: crypto.randomUUID(),
        plant_id: plant.plant_id,
        plant_name: plant.common_name,
        type: "identify",
        title: "Verify plant care data",
        priority: "high",
        due_date: today,
        reason:
          "Plant care baseline is unavailable, so species-specific watering and nutrition actions are blocked.",
        evidence_refs: buildEvidenceRefs(context, ["plant_identity"], plant),
        source_agents: ["Plant Knowledge Agent", "Evidence Agent"],
        status: "approved",
        confidence: 0.48,
      });
      continue;
    }

    const wateringDays = getSuggestedWateringDays(plant, context);
    const rain = context.environment.rainfall_mm;
    const soilMoisture = context.environment.soil_moisture;
    const shouldDelayWater =
      (rain !== null && rain >= 8) || (soilMoisture !== null && soilMoisture >= 0.42);
    const adjustmentSignals = [
      "soil type",
      "sunlight",
      rain !== null ? "rainfall" : null,
      context.environment.humidity_percent !== null ? "humidity" : null,
    ].filter(Boolean);

    actions.push({
      id: crypto.randomUUID(),
      plant_id: plant.plant_id,
      plant_name: plant.common_name,
      type: shouldDelayWater ? "skip_water" : "water",
      title: shouldDelayWater ? "Do not water today" : "Check watering today",
      priority: shouldDelayWater ? "medium" : wateringDays <= 3 ? "high" : "medium",
      due_date: today,
      reason: shouldDelayWater
        ? "Rainfall or soil moisture is high enough to delay watering."
        : `Watering cadence is about every ${wateringDays} days, adjusted using ${adjustmentSignals.join(", ")}.`,
      evidence_refs: buildEvidenceRefs(
        context,
        ["weather", "plant_knowledge", "user_input"],
        plant,
      ),
      source_agents: ["Environment Agent", "Plant Knowledge Agent", "Care Plan Agent"],
      status: "approved",
      confidence: plant.plant_knowledge.source === "perenual_api" ? 0.9 : 0.78,
    });

    if (context.environment.risk_flags.high_uv && plant.sunlight.label !== "full_sun") {
      actions.push({
        id: crypto.randomUUID(),
        plant_id: plant.plant_id,
        plant_name: plant.common_name,
        type: "shade",
        title: "Move plant to shade",
        priority: "high",
        due_date: today,
        reason: "High UV is active and this plant is not marked as full-sun.",
        evidence_refs: buildEvidenceRefs(context, ["weather", "user_input"], plant),
        source_agents: ["Environment Agent", "Soil & Placement Agent"],
        status: "approved",
        confidence: 0.82,
      });
    }

    if (context.environment.risk_flags.frost_risk) {
      actions.push({
        id: crypto.randomUUID(),
        plant_id: plant.plant_id,
        plant_name: plant.common_name,
        type: "protect",
        title: "Protect from frost",
        priority: "high",
        due_date: today,
        reason: "Forecast indicates frost risk.",
        evidence_refs: buildEvidenceRefs(context, ["weather", "user_input"], plant),
        source_agents: ["Environment Agent", "Care Plan Agent"],
        status: "approved",
        confidence: 0.86,
      });
    }

    if (context.environment.risk_flags.heavy_rain && plant.placement !== "indoor") {
      actions.push({
        id: crypto.randomUUID(),
        plant_id: plant.plant_id,
        plant_name: plant.common_name,
        type: "drainage",
        title: "Improve soil drainage setup",
        priority: "high",
        due_date: today,
        reason: "Heavy rain can waterlog outdoor containers and beds.",
        evidence_refs: buildEvidenceRefs(context, ["weather", "user_input"], plant),
        source_agents: ["Environment Agent", "Soil & Placement Agent"],
        status: "approved",
        confidence: 0.82,
      });
    }
  }

  actions.push({
    id: crypto.randomUUID(),
    plant_id: null,
    plant_name: "Garden",
    type: "inspect",
    title: "Inspect leaves for pests",
    priority: "medium",
    due_date: today,
    reason: "Weekly inspection catches visible pests and disease symptoms earlier.",
    evidence_refs: [
      {
        type: "rulebook",
        source: "Local care rulebook",
        supports: "weekly pest and disease inspection cadence",
      },
    ],
    source_agents: ["Care Plan Agent"],
    status: "approved",
    confidence: 0.74,
  });

  return actions;
}

export async function buildDiagnosisActions(
  userId: number,
): Promise<CarePlanAction[]> {
  const database = await getDatabase();
  const rows = await database
    .prepare(
      `
      SELECT plant_id, plant_nickname, category,
             diagnosis_evidence_status as evidence_status,
             issue, severity, created_at
      FROM diagnosis_runs
      WHERE user_id = ? AND datetime(created_at) >= datetime('now', '-14 day')
      ORDER BY datetime(created_at) DESC
      `,
    )
    .all(userId) as DiagnosisRow[];

  const seenPlants = new Set<string>();
  const actions: CarePlanAction[] = [];

  for (const row of rows) {
    if (row.evidence_status !== "confirmed") continue;
    if (row.category === "healthy") continue;
    if (row.issue === "Provider unavailable") continue;
    if (row.issue === "Needs more evidence") continue;
    if (seenPlants.has(row.plant_id)) continue;
    seenPlants.add(row.plant_id);
    const sev = row.severity === "high" ? "high" : row.severity === "medium" ? "medium" : "low";
    actions.push({
      id: crypto.randomUUID(),
      plant_id: row.plant_id,
      plant_name: row.plant_nickname,
      type: "inspect",
      title: "Recheck after diagnosis",
      priority: sev,
      due_date: addDays(sev === "high" ? 0 : 1),
      reason: `Recent diagnosis (${row.issue}) requires follow-up verification and care adjustment.`,
      evidence_refs: [
        {
          type: "diagnosis",
          source: "BloomPilot diagnosis history",
          supports: "recent severity and issue trend used for follow-up action",
        },
      ],
      source_agents: ["Care Plan Agent", "Evidence Agent"],
      status: "approved",
      confidence: 0.9,
    });
  }

  return actions;
}

export function validateCareActions(actions: CarePlanAction[]) {
  const approved: CarePlanAction[] = [];
  const rejected: CarePlanAction[] = [];

  for (const action of actions) {
    const hasEvidence = action.evidence_refs.length > 0;
    const hasReason = action.reason.trim().length > 0;
    const hasBlockingReason = Boolean(action.rejection_reason);
    const approvedAction = {
      ...action,
      status:
        hasEvidence && hasReason && !hasBlockingReason
          ? "approved" as const
          : "rejected" as const,
      rejection_reason:
        hasEvidence && hasReason && !hasBlockingReason
          ? undefined
          : action.rejection_reason
            ? action.rejection_reason
          : "Missing evidence or recommendation reason.",
    };

    if (approvedAction.status === "approved") {
      approved.push(approvedAction);
    } else {
      rejected.push(approvedAction);
    }
  }

  return { approved, rejected };
}

export function buildUpcomingTasks(actions: CarePlanAction[], context: ContextJson) {
  const today = addDays(0);
  const upcoming = actions
    .filter((action) => action.status === "approved" && action.due_date > today)
    .slice(0, 18);

  for (const plant of context.plants) {
    if (!plant.species) continue;
    upcoming.push({
      id: crypto.randomUUID(),
      plant_id: plant.plant_id,
      plant_name: plant.common_name,
      type: "inspect",
      title: "Weekly health inspection",
      priority: "medium",
      due_date: addDays(7),
      reason: "Inspect leaves, stems and soil line for pests, spots, wilting or drainage issues.",
      evidence_refs: buildEvidenceRefs(context, ["plant_identity", "user_input"], plant),
      source_agents: ["Care Plan Agent"],
      status: "approved",
      confidence: 0.72,
    });
    upcoming.push({
      id: crypto.randomUUID(),
      plant_id: plant.plant_id,
      plant_name: plant.common_name,
      type: "prune",
      title: "Clean dead or yellow leaves",
      priority: "low",
      due_date: addDays(7),
      reason: "Cleaning weak foliage lowers pest and disease pressure.",
      evidence_refs: buildEvidenceRefs(context, ["plant_identity", "user_input"], plant),
      source_agents: ["Care Plan Agent"],
      status: "approved",
      confidence: 0.68,
    });
  }

  return dedupeCareActions(upcoming)
    .sort((left, right) => left.due_date.localeCompare(right.due_date))
    .slice(0, 28);
}

export function buildWateringForecast(context: ContextJson): PlantWateringForecast[] {
  const dailyForecast = getDailyForecast(context);
  const rain = context.environment.rainfall_mm;
  const soilMoisture = context.environment.soil_moisture;
  const shouldDelay =
    (rain !== null && rain >= 8) || (soilMoisture !== null && soilMoisture >= 0.42);

  return context.plants.map((plant) => {
    if (!plant.species) {
      return {
        plant_id: plant.plant_id,
        plant_name: plant.common_name,
        interval_days: null,
        days: Array.from({ length: 7 }, (_, index) => ({
          date: addDays(index),
          should_water: false,
          label: "check" as const,
          reason: "Identify species before generating a watering forecast.",
        })),
      };
    }

    const interval = getSuggestedWateringDays(plant, context);
    const days = Array.from({ length: 7 }, (_, index) => {
      const dayForecast = dailyForecast[index];
      const dayRain =
        dayForecast?.rainfall_mm ?? (index === 0 ? context.environment.rainfall_mm : null);
      const dayShouldDelay =
        (dayRain !== null && dayRain >= 8) || (index === 0 && shouldDelay);

      if (dayShouldDelay) {
        return {
          date: dayForecast?.date ?? addDays(index),
          should_water: false,
          label: "skip" as const,
          reason:
            dayRain !== null && dayRain >= 8
              ? "Delay because forecast rainfall is high."
              : "Delay because soil moisture evidence is high.",
        };
      }

      const shouldWater = index > 0 && index % interval === 0;
      return {
        date: dayForecast?.date ?? addDays(index),
        should_water: shouldWater,
        label: shouldWater ? "water" as const : "check" as const,
        reason: shouldWater
          ? `Watering interval is about every ${interval} days.`
          : "Check top soil before watering.",
      };
    });

    return {
      plant_id: plant.plant_id,
      plant_name: plant.common_name,
      interval_days: interval,
      days,
    };
  });
}

export function buildWeatherRiskForecast(context: ContextJson): WeatherRiskForecastDay[] {
  const dailyForecast = getDailyForecast(context);
  if (dailyForecast.length > 0) {
    return dailyForecast.slice(0, 7).map((day) => {
      const humidity = context.environment.humidity_percent;
      // The forecast payload has no daily humidity values. Only apply the
      // measured humidity risk to today; do not project it across the week.
      const humidityStress = day.date === addDays(0) && humidity !== null && (humidity <= 35 || humidity >= 85);
      return {
        date: day.date,
        heat_stress: day.heat_stress,
        frost_risk: day.frost_risk,
        heavy_rain: day.heavy_rain,
        high_uv: day.high_uv,
        humidity_stress: humidityStress,
        risk_count: [
          day.heat_stress,
          day.frost_risk,
          day.heavy_rain,
          day.high_uv,
          humidityStress,
        ].filter(Boolean).length,
      };
    });
  }

  return [];
}

export function buildCareCalendar(tasks: CarePlanAction[]): CareCalendarGroup[] {
  const today = addDays(0);
  const tomorrow = addDays(1);
  const weekEnd = addDays(7);

  return [
    {
      label: "Today",
      date_range: today,
      tasks: tasks.filter((task) => task.due_date === today),
    },
    {
      label: "Tomorrow",
      date_range: tomorrow,
      tasks: tasks.filter((task) => task.due_date === tomorrow),
    },
    {
      label: "This week",
      date_range: `${addDays(2)} to ${weekEnd}`,
      tasks: tasks.filter((task) => task.due_date > tomorrow && task.due_date <= weekEnd),
    },
  ];
}

function normalizedIncludes(source: string | null | undefined, target: string) {
  const left = (source ?? "").toLowerCase().replaceAll("_", "").replaceAll(" ", "");
  const right = target.toLowerCase().replaceAll("_", "").replaceAll(" ", "");
  return left.includes(right);
}

export function buildSetupMismatches(context: ContextJson): PlantSetupMismatch[] {
  const mismatches: PlantSetupMismatch[] = [];

  for (const plant of context.plants) {
    if (!plant.species) {
      mismatches.push({
        plant_id: plant.plant_id,
        plant_name: plant.common_name,
        type: "identity",
        severity: "high",
        current: "Missing species",
        expected: "Confirmed species",
        recommendation: "Identify the plant before relying on species-specific care.",
        evidence_refs: buildEvidenceRefs(context, ["plant_identity"], plant),
      });
      continue;
    }

    const sunlightPreference = plant.plant_knowledge.sunlight_preference;
    if (
      sunlightPreference &&
      !normalizedIncludes(sunlightPreference, plant.sunlight.label) &&
      !(sunlightPreference.includes("full") && plant.sunlight.label === "full_sun") &&
      !(sunlightPreference.includes("partial") && plant.sunlight.label === "partial_sun") &&
      !(sunlightPreference.includes("bright") && plant.sunlight.label === "bright_indirect")
    ) {
      mismatches.push({
        plant_id: plant.plant_id,
        plant_name: plant.common_name,
        type: "sunlight",
        severity: context.environment.risk_flags.high_uv ? "high" : "medium",
        current: toTitle(plant.sunlight.label),
        expected: toTitle(sunlightPreference),
        recommendation: "Adjust placement or shade level to better match the plant light baseline.",
        evidence_refs: buildEvidenceRefs(context, ["plant_knowledge", "user_input"], plant),
      });
    }

    const soilPreference = plant.plant_knowledge.soil_preference;
    if (
      soilPreference &&
      !normalizedIncludes(soilPreference, plant.soil.type) &&
      !soilPreference.includes("well_draining")
    ) {
      mismatches.push({
        plant_id: plant.plant_id,
        plant_name: plant.common_name,
        type: "soil",
        severity: plant.soil.drainage === "low" ? "high" : "medium",
        current: toTitle(plant.soil.type),
        expected: toTitle(soilPreference),
        recommendation: "Improve soil mix or drainage before increasing watering frequency.",
        evidence_refs: buildEvidenceRefs(context, ["plant_knowledge", "user_input"], plant),
      });
    }

    if (
      plant.placement === "terrace" &&
      (context.environment.risk_flags.high_uv || context.environment.risk_flags.heat_stress)
    ) {
      mismatches.push({
        plant_id: plant.plant_id,
        plant_name: plant.common_name,
        type: "placement",
        severity: "medium",
        current: "Terrace placement during weather stress",
        expected: "Protected exposure during peak stress",
        recommendation: "Use shade cloth or move containers away from peak afternoon sun.",
        evidence_refs: buildEvidenceRefs(context, ["weather", "user_input"], plant),
      });
    }
  }

  return mismatches;
}

export function buildReminderReadiness(
  actions: CarePlanAction[],
  context: ContextJson,
): ReminderReadinessItem[] {
  const channels = context.user.notification_preference.channels;
  const reminderWindow = context.user.notification_preference.time_window;
  const windowActive = isReminderWindowActive(
    {
      timezone: context.garden.location.timezone,
      reminderWindow,
    },
    new Date(),
  );
  return actions
    .filter((action) => action.status === "approved")
    .slice(0, 24)
    .map((action) => {
      const confident = action.confidence >= 0.65;
      const ready = channels.length > 0 && action.due_date.length > 0 && windowActive && confident;
      return {
        action_id: action.id,
        title: action.title,
        plant_name: action.plant_name,
        due_date: action.due_date,
        channels,
        reminder_window: reminderWindow,
        window_active: windowActive,
        ready,
        blocker: ready
          ? null
          : channels.length === 0
            ? "Select at least one reminder channel."
            : !windowActive
              ? "Outside the selected reminder window."
              : !confident
                ? "Confidence too low for automatic delivery."
                : "Missing notification channel or due date.",
      };
    });
}

function buildWaterBalance(context: ContextJson): PlantWaterBalance[] {
  const et0 = context.environment.evapotranspiration_mm ?? null;
  const rain = context.environment.rainfall_mm ?? null;
  const soilMoisture = context.environment.soil_moisture;

  return context.plants.map((plant) => {
    const baseNeed = plant.watering.mode === "custom" ? 0.55 : 0.65;
    const rainOffset = rain === null ? 0 : Math.min(0.45, rain / 30);
    const soilOffset = soilMoisture === null ? 0 : Math.max(0, Math.min(0.5, soilMoisture));
    const et0Pressure = et0 === null ? 0 : Math.min(0.18, et0 / 35);
    const net = Math.max(
      0,
      Math.min(
        1,
        baseNeed -
          rainOffset -
          soilOffset +
          et0Pressure +
          (plant.sunlight.label === "full_sun" ? 0.1 : 0),
      ),
    );
    return {
      plant_id: plant.plant_id,
      plant_name: plant.common_name,
      et0_mm: et0 === null ? null : Math.round(et0 * 10) / 10,
      rain_mm: rain,
      soil_moisture_ratio: soilMoisture,
      net_need_score: Math.round(net * 100) / 100,
      status: net >= 0.65 ? "high_need" : net >= 0.35 ? "moderate_need" : "low_need",
    };
  });
}

function buildRiskHorizon(context: ContextJson): RiskHorizon[] {
  const forecast = buildWeatherRiskForecast(context);
  const three = forecast.slice(0, 3);
  const seven = forecast.slice(0, 7);
  const count = (days: WeatherRiskForecastDay[], key: keyof WeatherRiskForecastDay) =>
    days.filter((d) => Boolean(d[key])).length;
  return [
    {
      window_days: 3,
      heat_stress_days: count(three, "heat_stress"),
      frost_risk_days: count(three, "frost_risk"),
      heavy_rain_days: count(three, "heavy_rain"),
      high_uv_days: count(three, "high_uv"),
    },
    {
      window_days: 7,
      heat_stress_days: count(seven, "heat_stress"),
      frost_risk_days: count(seven, "frost_risk"),
      heavy_rain_days: count(seven, "heavy_rain"),
      high_uv_days: count(seven, "high_uv"),
    },
  ];
}

async function buildCareAdherence(
  userId: number,
  actions: CarePlanAction[],
  context: ContextJson,
): Promise<CareAdherence> {
  const database = await getDatabase();
  const weeklyTotals = await database
    .prepare(
      `
      SELECT
        COUNT(*) AS due_count,
        SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS completed_count
      FROM care_tasks
      WHERE user_id = ?
        AND datetime(due_date) >= datetime('now', '-7 day')
        AND datetime(due_date) <= datetime('now', '+1 day')
      `,
    )
    .get(userId) as { due_count: number; completed_count: number | null } | undefined;

  const due = weeklyTotals?.due_count ?? actions.filter((a) => a.status === "approved").length;
  const completed = weeklyTotals?.completed_count ?? 0;

  const byPlantRows = await database
    .prepare(
      `
      SELECT
        plant_id,
        COUNT(*) AS due_count,
        SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS completed_count
      FROM care_tasks
      WHERE user_id = ?
        AND datetime(due_date) >= datetime('now', '-7 day')
        AND datetime(due_date) <= datetime('now', '+1 day')
      GROUP BY plant_id
      `,
    )
    .all(userId) as TaskAdherenceRow[];

  const byPlantMap = new Map(byPlantRows.map((row) => [row.plant_id, row]));
  return {
    weekly_due: due,
    weekly_completed: completed,
    weekly_completion_rate: due === 0 ? 0 : Math.round((completed / due) * 100),
    by_plant: context.plants.map((plant) => {
      const row = byPlantMap.get(plant.plant_id);
      const plantDue = row?.due_count ?? 0;
      const plantCompleted = row?.completed_count ?? 0;
      return {
        plant_id: plant.plant_id,
        plant_name: plant.common_name,
        due: plantDue,
        completed: plantCompleted,
        completion_rate: plantDue === 0 ? 0 : Math.round((plantCompleted / plantDue) * 100),
      };
    }),
  };
}

async function buildOutcomeTracking(userId: number): Promise<OutcomeTracking> {
  const database = await getDatabase();
  const rows = await database
    .prepare(
      `
      SELECT plant_id, issue, severity, diagnosis_evidence_status as evidence_status, category, created_at
      FROM diagnosis_runs
      WHERE user_id = ?
        AND datetime(created_at) >= datetime('now', '-30 day')
      ORDER BY datetime(created_at) DESC
      `,
    )
    .all(userId) as DiagnosisRow[];

  const confirmedRows = rows.filter(
    (row) =>
      row.evidence_status === "confirmed" &&
      row.category !== "healthy" &&
      row.issue !== "Provider unavailable" &&
      row.issue !== "Needs more evidence",
  );

  const total = confirmedRows.length;
  const issueCountByPlant = new Map<string, Set<string>>();
  for (const row of confirmedRows) {
    const key = `${row.plant_id}`;
    const set = issueCountByPlant.get(key) ?? new Set<string>();
    set.add(row.issue.toLowerCase().trim());
    issueCountByPlant.set(key, set);
  }

  const recurringPlants = [...issueCountByPlant.values()].filter((issues) => issues.size > 1).length;
  const recurrence = issueCountByPlant.size === 0 ? 0 : Math.round((recurringPlants / issueCountByPlant.size) * 100);
  return {
    total_diagnoses: total,
    symptom_recurrence_rate: recurrence,
    before_after_effectiveness: Math.max(0, 100 - recurrence),
  };
}

function buildRecommendationConfidence(
  actions: CarePlanAction[],
  context: ContextJson,
): RecommendationConfidence[] {
  return actions
    .filter((a) => a.status === "approved")
    .map((action) => {
      const plant = context.plants.find((p) => p.plant_id === action.plant_id);
      const identity = Boolean(plant?.species);
      const weather = context.environment.temperature_c !== null;
      const careKnowledge = Boolean(
        plant?.plant_knowledge.watering_baseline &&
          plant?.plant_knowledge.sunlight_preference &&
          plant?.plant_knowledge.soil_preference,
      );
      const score = Math.round(((identity ? 1 : 0) * 0.4 + (weather ? 1 : 0) * 0.3 + (careKnowledge ? 1 : 0) * 0.3) * 100);
      return {
        action_id: action.id,
        plant_name: action.plant_name,
        confidence_score: score,
        factors: {
          identity,
          weather,
          care_knowledge: careKnowledge,
        },
      };
    });
}

export async function buildCarePlanOutput(params: {
  userId: number;
  context: ContextJson;
  agentRunId: string;
  traces: AgentTrace[];
  approvedActions: CarePlanAction[];
  rejectedActions: CarePlanAction[];
  plantPlans: PlantCarePlan[];
}) {
  const healthScore = getHealthScore(params.context);
  const readiness = getReadiness(params.context);
  const evidence =
    params.context.plants.length > 0
      ? [
          ...params.context.evidence,
          {
            type: "plant_knowledge",
            source:
              params.context.plants[0]?.plant_knowledge.source ?? "local_rulebook_v1",
            supports: "baseline plant care requirements used by the Plant Knowledge Agent",
          },
        ]
      : params.context.evidence;

  const todayActions = dedupeCareActions(
    params.approvedActions.filter((action) => action.due_date === addDays(0)),
  );
  const upcomingTasks = buildUpcomingTasks(params.approvedActions, params.context);
  const scheduledActions = [...todayActions, ...upcomingTasks];
  const riskForecast = buildWeatherRiskForecast(params.context);

  return {
    id: `plan_${crypto.randomUUID()}`,
    context_id: params.context.context_id,
    agent_run_id: params.agentRunId,
    generated_at: new Date().toISOString(),
    status:
      readiness.location_ready &&
      readiness.weather_ready &&
      readiness.plant_species_ready &&
      readiness.plant_knowledge_ready
        ? "ready"
        : "partial",
    summary: {
      health_score: healthScore,
      health_band: getHealthBand(healthScore),
      total_plants: params.context.plants.length,
      identified_plants: params.context.plants.filter((plant) => plant.species).length,
      active_risks: getRiskCount(params.context),
      ready_for_reminders:
        params.approvedActions.some((action) => action.due_date && action.confidence >= 0.65) &&
        params.context.user.notification_preference.channels.length > 0,
    },
    today_actions: todayActions,
    upcoming_tasks: upcomingTasks,
    plant_plans: params.plantPlans,
    weather_risks: getWeatherRisks(params.context),
    health_readiness: readiness,
    evidence_sources: evidence,
    rejected_actions: params.rejectedActions,
    agent_traces: params.traces,
    watering_forecast: buildWateringForecast(params.context),
    weather_risk_forecast: riskForecast,
    care_calendar: buildCareCalendar(scheduledActions),
    setup_mismatches: buildSetupMismatches(params.context),
    reminder_readiness: buildReminderReadiness(scheduledActions, params.context),
    water_balance: buildWaterBalance(params.context),
    risk_horizon: buildRiskHorizon(params.context),
    care_adherence: await buildCareAdherence(params.userId, scheduledActions, params.context),
    outcome_tracking: await buildOutcomeTracking(params.userId),
    recommendation_confidence: buildRecommendationConfidence(params.approvedActions, params.context),
  } satisfies CarePlanOutput;
}

export async function saveCarePlan(userId: number, plan: CarePlanOutput) {
  await withTransaction(async (database) => {
    await database
      .prepare(
        `
        INSERT INTO care_plans (
          id, user_id, context_id, agent_run_id, status, plan_json, generated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        plan.id,
        userId,
        plan.context_id,
        plan.agent_run_id,
        plan.status,
        JSON.stringify(plan),
        plan.generated_at,
      );

    await database
      .prepare(
        `
        INSERT INTO agent_runs (id, user_id, trigger, created_at, payload_json)
        VALUES (?, ?, ?, ?, ?)
        `,
      )
      .run(
        plan.agent_run_id,
        userId,
        "care_plan_graph",
        plan.generated_at,
        JSON.stringify({
          care_plan_id: plan.id,
          context_id: plan.context_id,
          status: plan.status,
        }),
      );

    const insertTrace = await database.prepare(
      `
      INSERT INTO agent_traces (
        id, run_id, user_id, agent_name, status, input_summary,
        output_summary, evidence_json, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    );

    for (const trace of plan.agent_traces) {
      await insertTrace.run(
        trace.id,
        plan.agent_run_id,
        userId,
        trace.agent_name,
        trace.status,
        trace.input_summary,
        trace.output_summary,
        JSON.stringify(trace.evidence),
        trace.created_at,
      );
    }
  });
}

export async function readLatestCarePlan(userId: number) {
  const database = await getDatabase();
  const row = await database
    .prepare(
      `
      SELECT plan_json
      FROM care_plans
      WHERE user_id = ?
      ORDER BY datetime(generated_at) DESC
      LIMIT 1
      `,
    )
    .get(userId) as CarePlanRow | undefined;

  if (!row) {
    return null;
  }

  try {
    return sanitizeCarePlanOutput(JSON.parse(row.plan_json) as CarePlanOutput);
  } catch {
    return null;
  }
}

export async function appendDiagnosisTreatmentActions(
  userId: number,
  diagnosis: {
    plantId: string;
    plantNickname: string;
    issue: string;
    category: string;
    severity: "low" | "medium" | "high";
  },
) {
  const plan = await readLatestCarePlan(userId);
  if (!plan) return;

  const today = new Date().toISOString().slice(0, 10);
  const priority: CarePriority = diagnosis.severity === "high" ? "high" : diagnosis.severity === "medium" ? "medium" : "low";

  const categoryActionMap: Record<string, CareActionType> = {
    pest: "inspect",
    fungal: "disease_watch",
    watering: "drainage",
    root: "drainage",
    nutrient: "fertilize",
    environmental: "inspect",
  };

  const actionType: CareActionType = categoryActionMap[diagnosis.category] ?? "inspect";

  const titleMap: Record<CareActionType, string> = {
    inspect: `Inspect ${diagnosis.plantNickname} for ${diagnosis.issue}`,
    disease_watch: `Monitor ${diagnosis.plantNickname} for disease spread`,
    drainage: `Check drainage and watering for ${diagnosis.plantNickname}`,
    fertilize: `Apply targeted nutrition for ${diagnosis.plantNickname}`,
    water: `Water ${diagnosis.plantNickname}`,
    skip_water: `Skip watering ${diagnosis.plantNickname}`,
    move: `Relocate ${diagnosis.plantNickname}`,
    shade: `Shade ${diagnosis.plantNickname}`,
    protect: `Protect ${diagnosis.plantNickname}`,
    prune: `Prune ${diagnosis.plantNickname}`,
    identify: `Identify ${diagnosis.plantNickname}`,
  };

  const newAction: CarePlanAction = {
    id: crypto.randomUUID(),
    plant_id: diagnosis.plantId,
    plant_name: diagnosis.plantNickname,
    type: actionType,
    title: titleMap[actionType],
    priority,
    due_date: today,
    reason: `Diagnosis detected: ${diagnosis.issue} (${diagnosis.severity} severity). Immediate treatment action required.`,
    evidence_refs: [
      {
        type: "diagnosis",
        source: "BloomPilot AI Diagnosis",
        supports: `${diagnosis.issue} detected with ${diagnosis.severity} severity`,
      },
    ],
    source_agents: ["Diagnosis Agent"],
    status: "approved",
    confidence: 0.9,
  };

  const alreadyQueued = [...plan.today_actions, ...plan.upcoming_tasks].some(
    (action) =>
      action.plant_id === diagnosis.plantId &&
      action.type === actionType &&
      action.due_date === today &&
      action.status === "approved",
  );

  if (alreadyQueued) {
    return;
  }

  const updatedTodayActions = [newAction, ...plan.today_actions];
  const updatedPlan = sanitizeCarePlanOutput({
    ...plan,
    today_actions: updatedTodayActions,
    care_calendar: buildCareCalendar([...updatedTodayActions, ...plan.upcoming_tasks]),
  });

  const database = await getDatabase();
  const latest = await database
    .prepare(`SELECT id FROM care_plans WHERE user_id = ? ORDER BY datetime(generated_at) DESC LIMIT 1`)
    .get(userId) as { id: string } | undefined;
  if (!latest) return;
  await database
    .prepare(`UPDATE care_plans SET plan_json = ? WHERE id = ?`)
    .run(JSON.stringify(updatedPlan), latest.id);
}
