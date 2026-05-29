import { getPlantCareKnowledge } from "@/lib/plant-knowledge";
import { getPlantHealthSummary } from "@/lib/plant-memory";
import { getPlantFeedbackSummary } from "@/lib/action-feedback";
import { getDatabase } from "@/lib/database";
import { type ContextJson } from "@/lib/context-builder";
import {
  type CarePlanAction,
  type CareActionType,
  type CarePriority,
} from "@/lib/care-plan-engine";
import {
  requestOpenAIChat,
  type ChatMessage,
  type ChatToolCall,
  type ChatToolDefinition,
} from "@/lib/openai";

const MAX_ITERATIONS = 10;

type RawActionInput = {
  plant_id: string;
  plant_name: string;
  type: CareActionType;
  title: string;
  priority: CarePriority;
  due_date: string;
  reason: string;
  confidence: number;
};

const TOOLS: ChatToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "get_health_history",
      description:
        "Get a plant's health memory: recent care events (watered, skipped, diagnosed), consecutive skip count, last watered date, and last diagnosis issue. Call this for EVERY plant before planning.",
      parameters: {
        type: "object",
        properties: {
          plant_id: { type: "string", description: "The plant's ID" },
          plant_name: { type: "string", description: "The plant's name" },
        },
        required: ["plant_id", "plant_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_plant_knowledge",
      description:
        "Get full species-level scientific care data: watering baseline and interval, sunlight, soil, temperature range (min/max °C), humidity range, pH range, common pests, common diseases, toxicity, pruning months, companion plants, and care notes. Use this to recommend season-appropriate pruning, spot pest risk from the known pest list, warn about toxicity, and suggest companion planting.",
      parameters: {
        type: "object",
        properties: {
          species: {
            type: "string",
            description: "Plant species name (scientific or common)",
          },
        },
        required: ["species"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_action_feedback",
      description:
        "Get user feedback history for a plant's past care actions. Shows which action types got positive or negative responses. Call this for EVERY plant — if watering got repeated negative feedback, reduce frequency; if disease_watch got positive, keep it.",
      parameters: {
        type: "object",
        properties: {
          plant_id: { type: "string", description: "The plant ID" },
        },
        required: ["plant_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_watering_adjustment",
      description:
        "Propose a permanent adjustment to a plant's watering interval in the database when the evidence strongly supports a change (e.g., 3+ consecutive skips suggest interval is too frequent; repeated underwatering suggests interval is too long). Only call when confident the current interval is wrong.",
      parameters: {
        type: "object",
        properties: {
          plant_id: { type: "string", description: "The plant's ID" },
          plant_name: { type: "string", description: "The plant's name" },
          new_interval_days: {
            type: "number",
            description: "New recommended watering interval in days (1–30)",
          },
          reason: {
            type: "string",
            description: "Why this interval change is warranted based on evidence",
          },
        },
        required: ["plant_id", "plant_name", "new_interval_days", "reason"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "submit_care_plan",
      description:
        "Submit the final care plan. Call this ONLY after you have called get_health_history and get_action_feedback for every plant.",
      parameters: {
        type: "object",
        properties: {
          actions: {
            type: "array",
            description: "List of care actions for the garden today",
            items: {
              type: "object",
              properties: {
                plant_id: { type: "string" },
                plant_name: { type: "string" },
                type: {
                  type: "string",
                  enum: [
                    "water",
                    "skip_water",
                    "move",
                    "shade",
                    "protect",
                    "inspect",
                    "fertilize",
                    "prune",
                    "drainage",
                    "disease_watch",
                  ],
                },
                title: { type: "string" },
                priority: { type: "string", enum: ["high", "medium", "low"] },
                due_date: {
                  type: "string",
                  description: "ISO date YYYY-MM-DD",
                },
                reason: {
                  type: "string",
                  description:
                    "Evidence-grounded reason. Reference what you found (e.g. '3 consecutive skips + 38°C today, pest_list includes spider mites').",
                },
                confidence: {
                  type: "number",
                  description: "0.0 to 1.0 confidence in this action",
                },
              },
              required: [
                "plant_id",
                "plant_name",
                "type",
                "title",
                "priority",
                "due_date",
                "reason",
                "confidence",
              ],
            },
          },
        },
        required: ["actions"],
      },
    },
  },
];

async function executeTool(
  name: string,
  args: Record<string, unknown>,
  userId: number,
  context: ContextJson,
): Promise<unknown> {
  if (name === "get_health_history") {
    const plantId = args.plant_id as string;
    const summary = getPlantHealthSummary(userId, plantId);
    if (!summary) {
      return { available: false, message: "No health history recorded yet for this plant." };
    }
    return {
      available: true,
      consecutiveSkips: summary.consecutiveSkips,
      waterCount: summary.waterCount,
      skipCount: summary.skipCount,
      lastWateredAt: summary.lastWateredAt,
      lastDiagnosedAt: summary.lastDiagnosedAt,
      lastDiagnosisIssue: summary.lastDiagnosisIssue,
      recentEvents: summary.recentEvents.slice(0, 5).map((e) => ({
        type: e.eventType,
        detail: e.detail,
        date: e.createdAt.slice(0, 10),
      })),
    };
  }

  if (name === "get_plant_knowledge") {
    const species = args.species as string;
    const knowledge = await getPlantCareKnowledge(species);
    return {
      ...knowledge,
      _note: "Use pest_list for pest-season warnings, disease_list for disease_watch actions, toxicity for household safety notes, pruning_months to schedule prune actions, companion_plants for garden layout suggestions.",
    };
  }

  if (name === "get_action_feedback") {
    const plantId = args.plant_id as string;
    const summary = getPlantFeedbackSummary(userId, plantId);
    if (summary.positiveCount === 0 && summary.negativeCount === 0) {
      return { available: false, message: "No feedback recorded yet for this plant." };
    }
    return {
      available: true,
      positiveCount: summary.positiveCount,
      negativeCount: summary.negativeCount,
      negativeActionTypes: summary.negativeActionTypes,
      positiveActionTypes: summary.positiveActionTypes,
      note:
        summary.negativeActionTypes.length > 0
          ? `User gave negative feedback on: ${summary.negativeActionTypes.join(", ")}. Avoid or reduce those action types.`
          : "User feedback has been positive overall.",
    };
  }

  if (name === "propose_watering_adjustment") {
    const plantId = args.plant_id as string;
    const plantName = args.plant_name as string;
    const newInterval = Math.max(1, Math.min(30, Math.round(Number(args.new_interval_days))));
    const reason = args.reason as string;

    if (!plantId || !Number.isFinite(newInterval)) {
      return { success: false, error: "Invalid plant_id or new_interval_days" };
    }

    // Find current interval from context
    const plant = context.plants.find((p) => p.plant_id === plantId);
    const currentInterval = plant?.watering.custom_interval_days ?? null;

    // Apply garden watering modifier (e.g. terrace = 1.3x → shorter interval)
    const modifier = context.garden.watering_modifier ?? 1;
    const adjustedInterval = Math.max(1, Math.min(30, Math.round(newInterval / modifier)));

    try {
      const db = getDatabase();
      db.prepare(`UPDATE plants SET watering_interval_days = ? WHERE id = ? AND user_id = ?`)
        .run(adjustedInterval, plantId, userId);

      return {
        success: true,
        plant_name: plantName,
        previous_interval: currentInterval,
        new_interval: adjustedInterval,
        modifier_applied: modifier,
        reason,
        message: `Watering interval updated from ${currentInterval ?? "auto"} to ${adjustedInterval} days (garden modifier ${modifier}x applied).`,
      };
    } catch {
      return { success: false, error: "Database update failed" };
    }
  }

  return { error: `Unknown tool: ${name}` };
}

function buildSystemPrompt(): string {
  const today = new Date().toISOString().slice(0, 10);
  const currentMonth = new Date().toLocaleString("en-US", { month: "long" });

  return `You are BloomPilot's AI garden care agent. Generate a personalized, evidence-based daily care plan.

MANDATORY process — follow this exactly:
1. For EVERY plant: call get_health_history (check patterns)
2. For EVERY plant: call get_action_feedback (check what worked/didn't)
3. For any plant with issues, unknown species care, or pest/disease risk: call get_plant_knowledge
4. If a plant's watering interval is clearly wrong (3+ consecutive skips OR chronic underwatering): call propose_watering_adjustment
5. Call submit_care_plan with all actions

When using get_plant_knowledge results:
- pest_list → add inspect/disease_watch if any known pest is seasonal or weather-favored
- disease_list → add disease_watch if humidity is high or plant was recently diagnosed
- toxicity → add a note in the action reason if plant is toxic (for households with pets/children)
- pruning_months → add prune action if current month (${currentMonth}) is in pruning_months
- companion_plants → mention in care notes if relevant to garden layout
- temperature_min_c/max_c → escalate priority if current weather is near limits

Confidence calibration:
- full history + knowledge + feedback = 0.90+
- history + knowledge, no feedback = 0.75–0.89
- partial data = 0.60–0.74
- no history = 0.50–0.59

Rules:
- Every action MUST reference what you found in the evidence (tool results)
- If negative feedback exists for an action type, do NOT recommend it without strong counter-evidence
- If a plant has consecutive skips + heat stress, set priority to high
- If a plant was recently diagnosed, always include a disease_watch action
- Weather context is given — factor in heat, rain, UV when deciding actions
- Today: ${today}`;
}

function buildUserPrompt(context: ContextJson): string {
  const env = context.environment;
  const weather =
    env.temperature_c !== null
      ? `Temperature: ${env.temperature_c}°C (feels like ${env.apparent_temperature_c ?? env.temperature_c}°C, dew point ${env.dew_point_c ?? "?"}°C)
Today: high ${env.today_high_c ?? "?"}°C / low ${env.today_low_c ?? "?"}°C | Humidity: ${env.humidity_percent}% | Wind: ${env.wind_speed_kph ?? 0}kph | UV: ${env.uv_index}
Soil: ${env.soil_temperature_c ?? "?"}°C, moisture ${env.soil_moisture ?? "?"}
Water: rainfall ${env.rainfall_mm}mm, ET0 ${env.evapotranspiration_mm ?? "?"}mm
Light: ${env.daylight_hours ?? "?"}h (${env.sunrise_time ?? "?"} → ${env.sunset_time ?? "?"}) | GDD today: ${env.gdd_today ?? "?"}°C
Location: ${env.season} (${env.hemisphere}), ${env.climate_zone ?? "unknown"}, ${env.usda_zone ?? "?"}, elevation ${env.elevation_m ?? "?"}m
Air quality: ${env.air_quality ? `ozone=${env.air_quality.ozone ?? "?"}µg/m³, plant stress=${env.air_quality.plant_stress_risk}` : "unknown"}
Risks: heat=${env.risk_flags.heat_stress}, frost=${env.risk_flags.frost_risk}, heavy_rain=${env.risk_flags.heavy_rain}, high_uv=${env.risk_flags.high_uv}, high_wind=${env.risk_flags.high_wind}, disease=${env.risk_flags.disease_risk}`
      : "Weather data unavailable";

  const plantsText = context.plants
    .map(
      (p) =>
        `- ID: ${p.plant_id} | Name: ${p.common_name} | Species: ${p.species ?? "unknown"} | Placement: ${p.placement} | Sunlight: ${p.sunlight.label} | Watering every: ${p.watering.custom_interval_days ?? "auto"} days`,
    )
    .join("\n");

  return `Garden: ${context.garden.garden_type} in ${context.garden.location.input}
Garden context: ${context.garden.planner_note}
Watering modifier: ${context.garden.watering_modifier}x (adjust all watering intervals by this factor)
User: ${context.user.name}

Weather today:
${weather}

Plants (${context.plants.length}) — call get_health_history and get_action_feedback for EACH before submitting:
${plantsText || "No plants added yet"}

Start by calling get_health_history for each plant, then get_action_feedback for each, then get_plant_knowledge where needed, then submit_care_plan.`;
}

function enrichAction(raw: RawActionInput): CarePlanAction {
  const today = new Date().toISOString().slice(0, 10);
  return {
    id: crypto.randomUUID(),
    plant_id: raw.plant_id,
    plant_name: raw.plant_name,
    type: raw.type,
    title: raw.title,
    priority: raw.priority,
    due_date: raw.due_date || today,
    reason: raw.reason,
    evidence_refs: [
      {
        type: "agent_reasoning",
        source: "BloomPilot ReAct Care Planner",
        supports: raw.reason,
      },
    ],
    source_agents: ["ReAct Care Planner"],
    status: "approved",
    confidence: Math.min(1, Math.max(0, raw.confidence)),
  };
}

export async function runReActCarePlanner(
  context: ContextJson,
  userId: number,
): Promise<{ actions: CarePlanAction[]; toolCallCount: number; iterations: number }> {
  if (context.plants.length === 0) {
    return { actions: [], toolCallCount: 0, iterations: 0 };
  }

  const messages: ChatMessage[] = [
    { role: "system", content: buildSystemPrompt() },
    { role: "user", content: buildUserPrompt(context) },
  ];

  let toolCallCount = 0;
  let iterations = 0;
  let finalActions: CarePlanAction[] = [];

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    iterations++;
    const result = await requestOpenAIChat({ messages, tools: TOOLS, maxTokens: 3000 });

    if (result.finishReason === "stop" || result.toolCalls.length === 0) {
      break;
    }

    messages.push({
      role: "assistant",
      content: null,
      tool_calls: result.toolCalls,
    });

    for (const toolCall of result.toolCalls) {
      toolCallCount++;
      let args: Record<string, unknown>;
      try {
        args = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
      } catch {
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify({ error: "Invalid JSON arguments — please retry with valid JSON." }),
        });
        continue;
      }

      if (toolCall.function.name === "submit_care_plan") {
        const submitted = (args.actions ?? []) as RawActionInput[];
        finalActions = submitted.map(enrichAction);

        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify({ status: "accepted", count: finalActions.length }),
        });
        return { actions: finalActions, toolCallCount, iterations };
      }

      const toolResult = await executeTool(
        toolCall.function.name,
        args,
        userId,
        context,
      );

      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: JSON.stringify(toolResult),
      });
    }
  }

  return { actions: finalActions, toolCallCount, iterations };
}
