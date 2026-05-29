import {
  describeTaskTiming,
  formatShortDate,
  getRecentCompletedTasks,
  type TaskKind,
} from "@/lib/garden";
import { createDailyBrief } from "@/lib/agent-tools";
import { getDatabase } from "@/lib/database";
import { readRecentDiagnosisRuns } from "@/lib/diagnosis";
import { requestOpenAIJson } from "@/lib/openai";
import { appConfig } from "@/lib/app-config";
import { readSession } from "@/lib/session";
import { readWeatherSnapshot } from "@/lib/weather";
import { upsertWorkspaceProfile } from "@/lib/workspace-store";

export type AgentPriority = {
  id: string;
  plantId: string;
  kind: TaskKind;
  title: string;
  dueDate: string;
  timing: string;
  reason: string;
};

export type AgentFocusPlant = {
  id: string;
  nickname: string;
  species: string;
  score: number;
  openCount: number;
  overdueCount: number;
  recommendation: string;
};

export type AgentRunPayload = {
  headline: string;
  overview: string;
  priorities: AgentPriority[];
  focusPlants: AgentFocusPlant[];
  recommendations: string[];
  recap: string[];
};

export type StoredAgentRun = {
  id: string;
  trigger: string;
  createdAt: string;
  payload: AgentRunPayload;
};

type AgentRunRow = {
  id: string;
  trigger: string;
  created_at: string;
  payload_json: string;
};

async function getCurrentWorkspaceUserId() {
  const session = await readSession();

  if (!session) {
    return null;
  }

  return upsertWorkspaceProfile(session);
}

function buildPayload() {
  return createDailyBrief().then(async ({ garden, brief, metrics }) => {
    const completed = getRecentCompletedTasks(garden.tasks).slice(0, 3);
    const session = await readSession();
    const diagnosisHistory = await readRecentDiagnosisRuns(3);
    const weather =
      session?.latitude !== undefined && session.longitude !== undefined
        ? await readWeatherSnapshot(session.latitude, session.longitude).catch(() => null)
        : null;

    const priorities: AgentPriority[] = brief.priorities.map((task) => ({
      id: task.id,
      plantId: task.plantId,
      kind: task.kind,
      title: task.title,
      dueDate: task.dueDate,
      timing: describeTaskTiming(task.dueDate),
      reason:
        task.kind === "water"
          ? "Water cadence slipped or is due now."
          : task.kind === "inspect"
            ? "Health check keeps the plant stable before issues compound."
            : "Nutrition cadence is due based on the current care schedule.",
    }));

    const focusPlants: AgentFocusPlant[] = brief.focusPlants.map(
      ({ plant, stats }) => ({
        id: plant.id,
        nickname: plant.nickname,
        species: plant.species,
        score: stats.score,
        openCount: stats.openCount,
        overdueCount: stats.overdueCount,
        recommendation:
          stats.overdueCount > 0
            ? `Recover ${plant.nickname} first and clear the overdue queue.`
            : stats.openCount > 1
              ? `Keep ${plant.nickname} in the first half of today's routine.`
              : `${plant.nickname} is stable; keep its cadence consistent.`,
      }),
    );

    const fallbackRecommendations = [
      metrics.overdue > 0
        ? `Start with ${metrics.overdue} overdue task${metrics.overdue === 1 ? "" : "s"} before new care work.`
        : "No overdue work is blocking the garden right now.",
      metrics.dueToday > 0
        ? `${metrics.dueToday} task${metrics.dueToday === 1 ? "" : "s"} are due today.`
        : "Today's queue is light; use the gap for inspection and cleanup.",
      weather
        ? weather.rainLikely
          ? "Rain is likely today, so review outdoor watering before adding more water."
          : weather.heatRisk
            ? "Higher heat is expected, so inspect moisture-sensitive plants earlier in the day."
            : weather.summary
        : metrics.plantCount > 0
          ? `BloomPilot is actively tracking ${metrics.plantCount} plant${metrics.plantCount === 1 ? "" : "s"}.`
          : "Add your first plant to activate the daily summary.",
    ];

    const recap = completed.length
      ? completed.map(
          (task) =>
            `${task.title} completed ${task.completedAt ? formatShortDate(task.completedAt) : "recently"}.`,
        )
      : ["No completed care actions yet."];

    const headline = brief.headline;
    const overview = weather
      ? `${brief.overview} Local weather: ${weather.summary}`
      : brief.overview;
    let recommendations = fallbackRecommendations;

    if (!appConfig.strictProductionMode) {
      try {
      const aiCopy = await requestOpenAIJson<{
        headline: string;
        overview: string;
        recommendations: string[];
      }>({
        prompt: `
You are generating a daily summary for a gardening SaaS app.

User context:
- location: ${session?.location ?? "unknown"}
- weather: ${weather ? weather.summary : "unavailable"}
- plants tracked: ${metrics.plantCount}
- open tasks: ${metrics.openTasks}
- due today: ${metrics.dueToday}
- overdue: ${metrics.overdue}

Top priorities:
${priorities.length > 0 ? priorities.map((task) => `- ${task.title} (${task.timing})`).join("\n") : "- none"}

Recent diagnoses:
${diagnosisHistory.length > 0 ? diagnosisHistory.map((item) => `- ${item.plantNickname}: ${item.issue}`).join("\n") : "- none"}

Return JSON only with this exact shape:
{
  "headline": string,
  "overview": string,
  "recommendations": string[]
}

Rules:
- headline should be under 80 characters
- overview should be 2 short sentences max
- recommendations should contain exactly 3 short items
- be direct, calm, and product-ready
        `.trim(),
        maxOutputTokens: 350,
      });

      recommendations =
        Array.isArray(aiCopy.recommendations) && aiCopy.recommendations.length > 0
          ? aiCopy.recommendations.map((item) => item.trim()).filter(Boolean).slice(0, 3)
          : recommendations;
      } catch {
        recommendations = fallbackRecommendations;
      }
    }

    return {
      headline,
      overview,
      priorities,
      focusPlants,
      recommendations,
      recap,
    } satisfies AgentRunPayload;
  });
}

export async function runAgentBrief(trigger = "manual") {
  const userId = await getCurrentWorkspaceUserId();

  if (!userId) {
    return null;
  }

  const payload = await buildPayload();
  const database = getDatabase();
  const runId = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  database
    .prepare(
      `
        INSERT INTO agent_runs (id, user_id, trigger, created_at, payload_json)
        VALUES (?, ?, ?, ?, ?)
      `,
    )
    .run(runId, userId, trigger, createdAt, JSON.stringify(payload));

  return {
    id: runId,
    trigger,
    createdAt,
    payload,
  } satisfies StoredAgentRun;
}

export async function readLatestAgentRun() {
  const userId = await getCurrentWorkspaceUserId();

  if (!userId) {
    return null;
  }

  const database = getDatabase();
  const row = database
    .prepare(
      `
        SELECT id, trigger, created_at, payload_json
        FROM agent_runs
        WHERE user_id = ?
        ORDER BY datetime(created_at) DESC
        LIMIT 1
      `,
    )
    .get(userId) as AgentRunRow | undefined;

  if (!row) {
    return null;
  }

  let payload: AgentRunPayload;
  try {
    payload = JSON.parse(row.payload_json) as AgentRunPayload;
  } catch {
    return null;
  }

  return {
    id: row.id,
    trigger: row.trigger,
    createdAt: row.created_at,
    payload,
  } satisfies StoredAgentRun;
}

export async function readOrCreateLatestAgentRun() {
  const latest = await readLatestAgentRun();

  if (latest) {
    return latest;
  }

  return runAgentBrief("auto");
}
