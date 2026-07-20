import { NextResponse, type NextRequest } from "next/server";
import { requireApiSession } from "@/lib/api-session";
import { readWorkspaceIdentityByEmail } from "@/lib/workspace-store";
import { readLatestCarePlan } from "@/lib/care-plan-engine";
import { getGardenHealthHistory, getAllPlantHealthSummaries } from "@/lib/plant-memory";
import { type ChatMessage } from "@/lib/openai";
import { getDatabase } from "@/lib/database";
import { readWeatherSnapshot } from "@/lib/weather";
import { readGardenState } from "@/lib/garden";
import { readRecentDiagnosisRuns } from "@/lib/diagnosis";
import { readCurrentReminderChannelReadiness, readLatestReminderRun } from "@/lib/reminders";

export const dynamic = "force-dynamic";

const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";

function requireOpenAIKey() {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error("OPENAI_API_KEY is missing");
  return key;
}

function compactJson(value: unknown, maxCharacters = 14000) {
  const raw = JSON.stringify(value, null, 0);
  return raw.length > maxCharacters ? `${raw.slice(0, maxCharacters)}…` : raw;
}

function buildSystemPrompt(context: {
  profile: unknown;
  plants: unknown;
  tasks: unknown;
  activities: unknown;
  diagnoses: unknown;
  healthEvents: unknown;
  carePlan: unknown;
  reminders: unknown;
  weather: unknown;
}) {
  return `You are BloomPilot's garden assistant. You have a read-only snapshot of the user's real workspace below. Use it as the source of truth.

WORKSPACE PROFILE
${compactJson(context.profile, 4000)}

PLANTS AND SETUP
${compactJson(context.plants, 12000)}

TASKS
${compactJson(context.tasks, 14000)}

RECENT CARE ACTIVITY
${compactJson(context.activities, 10000)}

DIAGNOSIS HISTORY
${compactJson(context.diagnoses, 14000)}

PLANT HEALTH EVENTS
${compactJson(context.healthEvents, 12000)}

CURRENT CARE PLAN
${compactJson(context.carePlan, 18000)}

REMINDER DELIVERY
${compactJson(context.reminders, 8000)}

CURRENT WEATHER
${compactJson(context.weather, 4000)}

Rules:
- Answer the user's question directly, then give the smallest useful next step.
- Use exact plant names, task titles, dates, diagnosis findings, and delivery statuses from the snapshot when relevant.
- Separate recorded facts, care-plan recommendations, and general advice.
- A confirmed diagnosis may be described as confirmed. A possible or unconfirmed finding must never be presented as a confirmed disease.
- Never say a reminder was sent unless its delivery status is sent. Queued, failed, suppressed, and not run are different states.
- Do not claim a task is complete unless the task or activity says it is complete.
- Do not invent plants, diagnoses, weather, tasks, notification channels, or preferences.
- If the snapshot does not answer the question, say what is missing and give a safe general suggestion.
- You are read-only. Do not claim to change tasks, plants, reminders, or plans from chat.
- Avoid internal implementation terms, agent names, raw IDs, or long evidence dumps.
- Today's date is ${new Date().toISOString().slice(0, 10)}.`;
}

export async function POST(request: NextRequest) {
  const { session, response } = await requireApiSession();
  if (!session || response) return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const identity = readWorkspaceIdentityByEmail(session.email);
  if (!identity) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null) as { messages?: unknown } | null;
  if (!body || !Array.isArray(body.messages) || body.messages.length === 0 || body.messages.length > 20) {
    return NextResponse.json({ error: "messages required" }, { status: 400 });
  }
  const messages = body.messages.filter((message): message is ChatMessage => {
    if (!message || typeof message !== "object") return false;
    const candidate = message as { role?: unknown; content?: unknown };
    return (candidate.role === "user" || candidate.role === "assistant") && typeof candidate.content === "string" && candidate.content.trim().length > 0 && candidate.content.length <= 4000;
  });
  if (messages.length !== body.messages.length) return NextResponse.json({ error: "Invalid message format" }, { status: 400 });

  const db = getDatabase();
  type UserRow = { name: string; location: string; garden_type: string; latitude: number | null; longitude: number | null };
  const userRow = db.prepare(`SELECT name, location, garden_type, latitude, longitude FROM users WHERE id = ?`)
    .get(identity.id) as UserRow | undefined;

  const [gardenState, plan, healthSummaries, healthEvents, diagnoses, latestReminder, reminderReadiness] = await Promise.all([
    readGardenState(),
    Promise.resolve(readLatestCarePlan(identity.id)),
    Promise.resolve(getAllPlantHealthSummaries(identity.id)),
    Promise.resolve(getGardenHealthHistory(identity.id, 100)),
    readRecentDiagnosisRuns(20),
    readLatestReminderRun(),
    readCurrentReminderChannelReadiness(),
  ]);

  type TaskRow = { id: string; title: string; kind: string; plant_id: string; status: string; due_date: string; completed_at: string | null };
  const taskRows = db.prepare(
    `SELECT id, title, kind, plant_id, status, due_date, completed_at
     FROM care_tasks WHERE user_id = ?
     ORDER BY CASE WHEN status = 'open' THEN 0 ELSE 1 END, datetime(due_date) ASC
     LIMIT 100`,
  ).all(identity.id) as TaskRow[];

  type ActivityRow = { id: string; type: string; title: string; detail: string; created_at: string; plant_id: string | null };
  const activityRows = db.prepare(
    `SELECT id, type, title, detail, created_at, plant_id
     FROM activities WHERE user_id = ? ORDER BY datetime(created_at) DESC LIMIT 60`,
  ).all(identity.id) as ActivityRow[];

  // Fetch weather if coordinates available
  let weatherText = "Weather: unavailable (no location coordinates)";
  if (userRow?.latitude !== null && userRow?.latitude !== undefined && userRow?.longitude !== null && userRow?.longitude !== undefined) {
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
      profile: {
        name: userRow?.name ?? "Gardener",
        email: session.email,
        location: userRow?.location ?? null,
        gardenType: userRow?.garden_type ?? null,
        reminderWindow: session.reminderWindow,
        channels: session.channels,
        timezone: session.timezone ?? null,
      },
      plants: gardenState.plants,
      tasks: taskRows,
      activities: activityRows,
      diagnoses: diagnoses.map((diagnosis) => ({
        plant: diagnosis.plantNickname,
        species: diagnosis.plantSpecies,
        issue: diagnosis.issue,
        category: diagnosis.category,
        severity: diagnosis.severity,
        confidence: diagnosis.confidence,
        evidenceStatus: diagnosis.evidenceStatus,
        findings: diagnosis.findings,
        summary: diagnosis.summary,
        treatment: diagnosis.treatment,
        followUp: diagnosis.followUp,
        createdAt: diagnosis.createdAt,
      })),
      healthEvents: {
        summaries: healthSummaries,
        events: healthEvents.map((event) => ({
          plant: event.plantName,
          type: event.eventType,
          detail: event.detail,
          createdAt: event.createdAt,
        })),
      },
      carePlan: plan
        ? {
            summary: plan.summary,
            todayActions: plan.today_actions,
            upcomingTasks: plan.upcoming_tasks,
            careCalendar: plan.care_calendar,
            plantPlans: plan.plant_plans,
            wateringForecast: plan.watering_forecast,
            weatherRisks: plan.weather_risks,
          }
        : null,
      reminders: {
        readiness: reminderReadiness,
        latestRun: latestReminder
          ? {
              createdAt: latestReminder.createdAt,
              trigger: latestReminder.trigger,
              headline: latestReminder.payload.headline,
              summary: latestReminder.payload.summary,
              sent: latestReminder.payload.sent_count,
              queued: latestReminder.payload.queued_count,
              failed: latestReminder.payload.failed_count,
              suppressed: latestReminder.payload.suppressed_count,
              deliveries: latestReminder.payload.deliveries,
              suppressions: latestReminder.payload.suppression_reasons,
            }
          : null,
      },
      weather: weatherText,
    }),
  };

  let openaiResponse: Response;
  try {
    openaiResponse = await fetch(OPENAI_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireOpenAIKey()}`,
      "Content-Type": "application/json",
    },
      body: JSON.stringify({
      model: process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini",
      messages: [systemMessage, ...messages],
      max_tokens: 600,
      stream: true,
    }),
    });
  } catch {
    return NextResponse.json({ error: "AI service unavailable" }, { status: 503 });
  }

  if (!openaiResponse.ok) {
    return NextResponse.json({ error: "AI service rejected the request" }, { status: 502 });
  }

  return new Response(openaiResponse.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
