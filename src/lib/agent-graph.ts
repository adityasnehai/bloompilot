import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import {
  buildCarePlanOutput,
  buildRawCareActions,
  buildPlantCarePlans,
  saveCarePlan,
  validateCareActions,
  type AgentTrace,
  type CarePlanAction,
  type CarePlanOutput,
  type PlantCarePlan,
} from "@/lib/care-plan-engine";
import { logger } from "@/lib/logger";
import {
  describeReminderMode,
  formatReminderChannelSequence,
  extractReminderChannels,
  normalizeReminderChannels,
} from "@/lib/reminder-channels";
import {
  buildGardenContext,
  isGardenContextSnapshotStale,
  readLatestContextSnapshot,
  type ContextJson,
} from "@/lib/context-builder";
import { runReActCarePlanner } from "@/lib/care-planner-react";
import { runAlertObserver } from "@/lib/alert-observer";
import { enrichSpeciesBatch } from "@/lib/plant-enrichment";
import { isReminderWindowActive } from "@/lib/reminders";

type ReactPlannerReport = {
  toolCallCount: number;
  iterations: number;
};

type EnvironmentReport = {
  available: boolean;
  skipped: boolean;
  risk_count: number;
  summary: string;
};

type PlantKnowledgeReport = {
  complete_count: number;
  partial_count: number;
  sources: string[];
};

type ReminderQueueReport = {
  ready_count: number;
  blocked_count: number;
  channels: string[];
  reminder_window: string;
  window_active: boolean;
};

type RunCareAgentsInput = {
  userId: number;
  userEmail: string;
  trigger?: string;
};

function trace(params: {
  agent: string;
  status?: AgentTrace["status"];
  input: string;
  output: string;
  evidence?: AgentTrace["evidence"];
}) {
  return {
    id: crypto.randomUUID(),
    agent_name: params.agent,
    status: params.status ?? "success",
    input_summary: params.input,
    output_summary: params.output,
    evidence: params.evidence ?? [],
    created_at: new Date().toISOString(),
  } satisfies AgentTrace;
}

function formatAgentMetric(value: number | null, unit: string) {
  return value === null ? "no data" : `${value}${unit}`;
}

const CareAgentState = Annotation.Root({
  userId: Annotation<number>(),
  trigger: Annotation<string>(),
  agentRunId: Annotation<string>(),
  context: Annotation<ContextJson | null>(),
  environmentReport: Annotation<EnvironmentReport | null>(),
  plantKnowledgeReport: Annotation<PlantKnowledgeReport | null>(),
  reactPlannerReport: Annotation<ReactPlannerReport | null>(),
  plantPlans: Annotation<PlantCarePlan[]>({
    reducer: (_left, right) => right,
    default: () => [],
  }),
  rawActions: Annotation<CarePlanAction[]>({
    reducer: (_left, right) => right,
    default: () => [],
  }),
  approvedActions: Annotation<CarePlanAction[]>({
    reducer: (_left, right) => right,
    default: () => [],
  }),
  rejectedActions: Annotation<CarePlanAction[]>({
    reducer: (_left, right) => right,
    default: () => [],
  }),
  reminderQueueReport: Annotation<ReminderQueueReport | null>(),
  carePlan: Annotation<CarePlanOutput | null>(),
  traces: Annotation<AgentTrace[]>({
    reducer: (left, right) => left.concat(right),
    default: () => [],
  }),
});

type CareAgentStateType = typeof CareAgentState.State;

async function contextBuilderAgent(state: CareAgentStateType) {
  const cached = await readLatestContextSnapshot(state.userId);
  const context = isGardenContextSnapshotStale(cached) ? await buildGardenContext(state.userId) : cached!;
  emitProgress(state.agentRunId, "context");
  return {
    context,
    traces: [
      trace({
        agent: "Context Builder Agent",
        input: `user_id=${state.userId}`,
        output: `Loaded ${context.plants.length} plants, ${context.garden.garden_type} garden, ${context.garden.location.input}.`,
        evidence: [
          {
            type: "user_input",
            source: "SQLite workspace profile and plant records",
            supports: "user, garden, placement, soil, sunlight and watering context",
          },
        ],
      }),
    ],
  };
}

async function environmentAgent(state: CareAgentStateType) {
  const context = requireContext(state);
  const weatherReady = context.environment.temperature_c !== null;
  const riskValues = Object.values(context.environment.risk_flags);
  const riskCount = riskValues.filter(Boolean).length;
  const skipped =
    context.garden.location.lat === null || context.garden.location.lon === null;
  const summary = weatherReady
    ? `Weather loaded: ${formatAgentMetric(context.environment.temperature_c, "C")}, humidity ${formatAgentMetric(context.environment.humidity_percent, "%")}, rainfall ${formatAgentMetric(context.environment.rainfall_mm, "mm")}, UV ${context.environment.uv_index ?? "no data"}.`
    : skipped
      ? "Location coordinates are missing, so weather lookup was skipped."
      : "Weather unavailable; care plan will use plant and setup evidence only.";

  emitProgress(state.agentRunId, "environment");
  return {
    environmentReport: {
      available: weatherReady,
      skipped,
      risk_count: riskCount,
      summary,
    },
    traces: [
      trace({
        agent: "Environment Agent",
        status: weatherReady ? "success" : "warning",
        input: `${context.garden.location.lat ?? "missing"}, ${context.garden.location.lon ?? "missing"}`,
        output: summary,
        evidence: context.evidence.filter((entry) => entry.type === "weather"),
      }),
    ],
  };
}

async function plantKnowledgeAgent(state: CareAgentStateType) {
  const context = requireContext(state);

  // Enrich any plants still missing scientific data (temperature, pH, pest lists)
  const needsEnrichment = context.plants
    .filter(
      (plant) =>
        plant.species &&
        (plant.plant_knowledge.confidence === "low" ||
          plant.plant_knowledge.temperature_min_c === null),
    )
    .map((plant) => plant.species!)
    .filter(Boolean);

  if (needsEnrichment.length > 0) {
    try {
      await enrichSpeciesBatch(needsEnrichment);
    } catch {
      // enrichment failure must not block planning
    }
  }

  const missingKnowledge = context.plants.filter(
    (plant) =>
      !plant.plant_knowledge.watering_baseline ||
      !plant.plant_knowledge.sunlight_preference ||
      !plant.plant_knowledge.soil_preference,
  );
  const highConfidence = context.plants.filter(
    (plant) => plant.plant_knowledge.confidence === "high",
  ).length;
  const completeCount = context.plants.length - missingKnowledge.length;
  const sources = [
    ...new Set(context.plants.map((plant) => plant.plant_knowledge.source).filter(Boolean)),
  ];

  emitProgress(state.agentRunId, "knowledge");
  return {
    plantKnowledgeReport: {
      complete_count: completeCount,
      partial_count: missingKnowledge.length,
      sources,
    },
    traces: [
      trace({
        agent: "Plant Knowledge Agent",
        status: missingKnowledge.length > 0 ? "warning" : "success",
        input: `${context.plants.length} plant identities, ${needsEnrichment.length} queued for API enrichment`,
        output:
          missingKnowledge.length > 0
            ? `${missingKnowledge.length} plants have partial knowledge; ${highConfidence} plants have high-confidence scientific data.`
            : `All plants have care baselines; ${highConfidence}/${context.plants.length} with high-confidence scientific data.`,
        evidence: sources.map((source) => ({
          type: "plant_knowledge",
          source,
          supports: "watering, sunlight, soil, temperature, humidity, pH, pests, and toxicity",
        })),
      }),
    ],
  };
}

async function reactCarePlannerAgent(state: CareAgentStateType) {
  const context = requireContext(state);
  const plantPlans = buildPlantCarePlans(context);

  let plannerActions: CarePlanAction[] = [];
  let toolCallCount = 0;
  let iterations = 0;
  let fallbackUsed = false;

  try {
    const result = await runReActCarePlanner(context, state.userId);
    plannerActions = result.actions;
    toolCallCount = result.toolCallCount;
    iterations = result.iterations;
  } catch (error) {
    fallbackUsed = true;
    logger.warn("care_planner_llm_failed_using_fallback", {
      userId: state.userId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Keep the workspace actionable when the external planner fails or omits a plant.
  // These rules use the same saved context and weather evidence, not mock data.
  const fallbackActions = buildRawCareActions(context);

  // water and skip_water are mutually exclusive for the same plant on the same
  // day. The fallback's skip_water is a deterministic check against live
  // rain/soil-moisture data — if it fires, a planner-proposed "water" for that
  // same plant/date must be dropped, not merged alongside it as contradictory
  // advice (the planner's own baseline-driven watering suggestion can still
  // mention the rain in its reasoning without actually weighing it).
  const skipWaterKeys = new Set(
    fallbackActions
      .filter((action) => action.type === "skip_water")
      .map((action) => `${action.plant_id ?? "garden"}|${action.due_date}`),
  );
  const plannerActionsResolved = plannerActions.filter((action) => {
    if (action.type !== "water") return true;
    return !skipWaterKeys.has(`${action.plant_id ?? "garden"}|${action.due_date}`);
  });

  const coveredActionKeys = new Set(
    plannerActionsResolved.map((action) => `${action.plant_id ?? "garden"}|${action.type}|${action.due_date}`),
  );
  const rawActions = [
    ...plannerActionsResolved,
    ...fallbackActions.filter((action) => {
      // Only skip a fallback action when the planner already produced that exact
      // (plant, action type, date) combination — not merely because the planner
      // said *something* about this plant. Otherwise an unrelated planner action
      // (e.g. watering) silently suppresses a distinct safety action the fallback
      // would have added (e.g. frost protection) for the same plant.
      const key = `${action.plant_id ?? "garden"}|${action.type}|${action.due_date}`;
      if (coveredActionKeys.has(key)) return false;
      coveredActionKeys.add(key);
      return true;
    }),
  ];
  fallbackUsed = fallbackUsed || plannerActions.length === 0 || rawActions.length > plannerActionsResolved.length;

  emitProgress(state.agentRunId, "planner");

  // If model never submitted, surface this as a warning trace so dashboard can show banner
  const gaveUp = rawActions.length === 0 && context.plants.length > 0;
  if (gaveUp) {
    logger.error("care_planner_gave_up_zero_actions", {
      userId: state.userId, plantCount: context.plants.length, toolCallCount, iterations,
    });
  }
  return {
    plantPlans,
    rawActions,
    reactPlannerReport: { toolCallCount, iterations },
    traces: [
      trace({
        agent: "ReAct Care Planner",
        status: gaveUp ? "warning" : "success",
        input: `${context.plants.length} plants, ${context.environment.temperature_c !== null ? `${context.environment.temperature_c}°C` : "no weather"}`,
        output: gaveUp
          ? `Planner did not submit any actions after ${toolCallCount} tool calls / ${iterations} iterations. Retry the care plan.`
          : fallbackUsed
            ? `Generated ${plannerActions.length} planner actions and filled missing coverage with validated local care rules.`
            : `Generated ${rawActions.length} actions via ${toolCallCount} tool calls across ${iterations} iterations.`,
        evidence: [
          {
            type: "agent_reasoning",
            source: "BloomPilot ReAct Care Planner (GPT-4.1-mini + tool calling)",
            supports: "health history, plant knowledge, weather context, diagnosis history",
          },
        ],
      }),
    ],
  };
}

async function evidenceAgent(state: CareAgentStateType) {
  const { approved, rejected } = validateCareActions(state.rawActions);
  emitProgress(state.agentRunId, "evidence");
  return {
    approvedActions: approved,
    rejectedActions: rejected,
    traces: [
      trace({
        agent: "Evidence Agent",
        status: rejected.length > 0 ? "warning" : "success",
        input: `${state.rawActions.length} candidate care actions`,
        output: `Approved ${approved.length} actions and rejected ${rejected.length}.`,
        evidence: [
          {
            type: "evidence_validation",
            source: "Evidence Agent",
            supports: "every care action must include a reason and evidence references",
          },
        ],
      }),
    ],
  };
}

async function reminderAgent(state: CareAgentStateType) {
  const context = requireContext(state);
  const channels = normalizeReminderChannels(
    extractReminderChannels(context.user.notification_preference.channels),
    ["email"],
  );
  const reminderWindow = context.user.notification_preference.time_window;
  const windowActive = isReminderWindowActive(
    {
      timezone: context.garden.location.timezone,
      reminderWindow,
    },
    new Date(),
  );
  const readyActions = state.approvedActions.filter(
    (action) =>
      action.due_date &&
      channels.length > 0 &&
      action.confidence >= 0.65 &&
      windowActive,
  );
  const blockedCount = state.approvedActions.length - readyActions.length;
  const channelMode = describeReminderMode(channels);
  const channelOrder = formatReminderChannelSequence(channels);
  const summary =
    channels.length === 0
      ? "No reminder channels selected yet, so actions stay dashboard-only."
      : !windowActive
        ? `Reminder window ${reminderWindow} is closed right now, so ${blockedCount} approved actions wait for the next send slot.`
        : `${readyActions.length} actions are ready for reminder delivery in ${channelMode.toLowerCase()} mode via ${channelOrder}.`;

  return {
    reminderQueueReport: {
      ready_count: readyActions.length,
      blocked_count: blockedCount,
      channels,
      reminder_window: reminderWindow,
      window_active: windowActive,
    },
    traces: [
      trace({
        agent: "Reminder Agent",
        status: readyActions.length > 0 ? "success" : "warning",
        input: `${state.approvedActions.length} approved care actions`,
        output: summary,
        evidence: [
          {
            type: "reminder_preference",
            source: "BloomPilot user notification settings",
            supports: "delivery channel and reminder-window readiness",
          },
        ],
      }),
    ],
  };
}

async function dashboardAgent(state: CareAgentStateType) {
  const context = requireContext(state);
  const carePlan = await buildCarePlanOutput({
    userId: state.userId,
    context,
    agentRunId: state.agentRunId,
    traces: state.traces,
    approvedActions: state.approvedActions,
    rejectedActions: state.rejectedActions,
    plantPlans: state.plantPlans,
  });

  return {
    carePlan,
    traces: [
      trace({
        agent: "Dashboard Agent",
        input: `${state.approvedActions.length} approved actions`,
        output: `Prepared dashboard care plan ${carePlan.id}.`,
        evidence: carePlan.evidence_sources,
      }),
    ],
  };
}

function requireContext(state: CareAgentStateType) {
  if (!state.context) {
    throw new Error("Care agent context is missing");
  }
  return state.context;
}

function routeAfterContext(state: CareAgentStateType) {
  const context = requireContext(state);
  if (context.garden.location.lat === null || context.garden.location.lon === null) {
    return "plant_knowledge";
  }
  return "environment";
}

const careAgentGraph = new StateGraph(CareAgentState)
  .addNode("context_builder", contextBuilderAgent)
  .addNode("environment", environmentAgent)
  .addNode("plant_knowledge", plantKnowledgeAgent)
  .addNode("react_care_planner", reactCarePlannerAgent)
  .addNode("evidence", evidenceAgent)
  .addNode("reminder", reminderAgent)
  .addNode("dashboard", dashboardAgent)
  .addEdge(START, "context_builder")
  .addConditionalEdges("context_builder", routeAfterContext, {
    environment: "environment",
    plant_knowledge: "plant_knowledge",
  })
  .addEdge("environment", "plant_knowledge")
  .addEdge("plant_knowledge", "react_care_planner")
  .addEdge("react_care_planner", "evidence")
  .addEdge("evidence", "reminder")
  .addEdge("reminder", "dashboard")
  .addEdge("dashboard", END)
  .compile();

const _progressCallbacks = new Map<string, (step: string) => void>();

function emitProgress(runId: string | undefined, step: string) {
  if (!runId) return;
  _progressCallbacks.get(runId)?.(step);
}

export async function runCarePlanAgents(
  input: RunCareAgentsInput,
  onProgress?: (step: string) => void,
) {
  const agentRunId = `run_${crypto.randomUUID()}`;
  if (onProgress) _progressCallbacks.set(agentRunId, onProgress);

  try {
    const result = await careAgentGraph.invoke({
      userId: input.userId,
      trigger: input.trigger ?? "manual",
      agentRunId,
      context: null,
      environmentReport: null,
      plantKnowledgeReport: null,
      reactPlannerReport: null,
      plantPlans: [],
      rawActions: [],
      approvedActions: [],
      rejectedActions: [],
      reminderQueueReport: null,
      carePlan: null,
      traces: [],
    });

    if (!result.carePlan) {
      throw new Error("Care plan graph completed without a care plan");
    }

    const carePlan = {
      ...result.carePlan,
      agent_traces: result.traces,
    };

    await saveCarePlan(input.userId, carePlan);

    // run alert observer after every care plan — fires notifications for high-urgency anomalies
    runAlertObserver(input.userId, input.userEmail).catch(() => {
      // observer failure must not break the care plan response
    });

    return carePlan;
  } finally {
    _progressCallbacks.delete(agentRunId);
  }
}
