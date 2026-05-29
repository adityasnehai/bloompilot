import { NextResponse, type NextRequest } from "next/server";
import { requireApiSession } from "@/lib/api-session";
import { readWorkspaceIdentityByEmail } from "@/lib/workspace-store";
import { readLatestCarePlan } from "@/lib/care-plan-engine";
import { getAllPlantHealthSummaries } from "@/lib/plant-memory";
import { type ChatMessage } from "@/lib/openai";
import { getDatabase } from "@/lib/database";
import { readWeatherSnapshot } from "@/lib/weather";

export const dynamic = "force-dynamic";

const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";

function requireOpenAIKey() {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error("OPENAI_API_KEY is missing");
  return key;
}

function buildSystemPrompt(context: {
  userName: string;
  location: string;
  gardenType: string;
  planSummary: string;
  todayTasks: string;
  plantNames: string[];
  healthSummaries: string;
  weather: string;
}) {
  return `You are BloomPilot's plant care assistant. You help users understand their garden care plans, plant health, and general plant care advice.

User: ${context.userName} — ${context.gardenType} garden in ${context.location || "unknown location"}

${context.weather}

Garden care plan:
${context.planSummary}

Tasks due today:
${context.todayTasks || "None."}

Plants: ${context.plantNames.join(", ") || "None added yet"}

Plant health snapshots:
${context.healthSummaries || "No health history recorded yet."}

Rules:
- Be concise and practical
- Reference specific plants by name when relevant
- Use weather context to inform watering or pest advice
- If you don't know something, say so rather than guessing
- Today's date is ${new Date().toISOString().slice(0, 10)}`;
}

export async function POST(request: NextRequest) {
  const { session, response } = await requireApiSession();
  if (!session || response) return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const identity = readWorkspaceIdentityByEmail(session.email);
  if (!identity) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const body = (await request.json()) as { messages: ChatMessage[] };
  if (!body.messages || body.messages.length === 0) {
    return NextResponse.json({ error: "messages required" }, { status: 400 });
  }

  const db = getDatabase();
  type UserRow = { name: string; location: string; garden_type: string; latitude: number | null; longitude: number | null };
  const userRow = db.prepare(`SELECT name, location, garden_type, latitude, longitude FROM users WHERE id = ?`)
    .get(identity.id) as UserRow | undefined;

  // Fetch care plan and health summaries
  const plan = readLatestCarePlan(identity.id);
  const healthSummaries = getAllPlantHealthSummaries(identity.id);

  // Fetch today's open tasks from DB directly
  type TaskRow = { title: string; kind: string; plant_id: string };
  const todayTaskRows = db
    .prepare(`SELECT title, kind, plant_id FROM care_tasks WHERE user_id = ? AND date(due_date) = date('now') AND status = 'open' LIMIT 10`)
    .all(identity.id) as TaskRow[];

  // Map plant_id to nickname
  type PlantRow = { id: string; nickname: string };
  const plantRows = db.prepare(`SELECT id, nickname FROM plants WHERE user_id = ?`).all(identity.id) as PlantRow[];
  const plantNickname = new Map(plantRows.map((p) => [p.id, p.nickname]));

  const todayTasks = todayTaskRows
    .map((t) => {
      const plant = plantNickname.get(t.plant_id);
      return plant ? `- ${t.title} (${plant})` : `- ${t.title}`;
    })
    .join("\n");

  const planSummary = plan
    ? `Health score: ${plan.summary.health_score}/100 (${plan.summary.health_band}). ${plan.today_actions.length} tasks due today. ${plan.summary.active_risks} active weather risks.`
    : "No care plan generated yet.";

  const plantNames = plan?.plant_plans.map((p) => p.plant_name) ?? [];

  const healthText = healthSummaries
    .map(
      (s) =>
        `${s.plantName}: ${s.waterCount} waterings, ${s.skipCount} skips${s.consecutiveSkips > 0 ? `, ${s.consecutiveSkips} consecutive skips` : ""}${s.lastDiagnosisIssue ? `, last issue: ${s.lastDiagnosisIssue}` : ""}`,
    )
    .join("\n");

  // Fetch weather if coordinates available
  let weatherText = "Weather: unavailable (no location coordinates)";
  if (userRow?.latitude && userRow?.longitude) {
    try {
      const snapshot = await readWeatherSnapshot(userRow.latitude, userRow.longitude);
      weatherText = `Weather: ${snapshot.temperatureC !== null ? `${snapshot.temperatureC}°C` : "unknown temp"}, humidity ${snapshot.humidity !== null ? `${snapshot.humidity}%` : "unknown"}${snapshot.heatRisk ? ", heat risk active" : ""}${snapshot.frostRisk ? ", frost risk active" : ""}${snapshot.rainLikely ? ", rain expected" : ""}`;
    } catch {
      weatherText = "Weather: fetch failed";
    }
  }

  const systemMessage: ChatMessage = {
    role: "system",
    content: buildSystemPrompt({
      userName: userRow?.name ?? "Gardener",
      location: userRow?.location ?? "",
      gardenType: userRow?.garden_type ?? "mixed",
      planSummary,
      todayTasks,
      plantNames,
      healthSummaries: healthText,
      weather: weatherText,
    }),
  };

  const openaiResponse = await fetch(OPENAI_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireOpenAIKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini",
      messages: [systemMessage, ...body.messages],
      max_tokens: 600,
      stream: true,
    }),
  });

  if (!openaiResponse.ok) {
    const detail = await openaiResponse.text();
    return NextResponse.json({ error: `OpenAI error: ${detail}` }, { status: 500 });
  }

  return new Response(openaiResponse.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
