import { getDatabase } from "@/lib/database";
import { getAllPlantHealthSummaries, type PlantHealthSummary } from "@/lib/plant-memory";
import { buildGardenContext } from "@/lib/context-builder";
import { requestOpenAIChat, type ChatMessage, type ChatToolDefinition } from "@/lib/openai";
import { sendWebPushReminder, type PushSubscriptionRecord } from "@/lib/notifications/web-push";
import { sendEmailReminder } from "@/lib/notifications/email";
import { deactivatePushSubscription } from "@/lib/reminders";

export type AlertUrgency = "high" | "medium" | "low";

export type AlertType =
  | "overdue_watering"
  | "consecutive_skips"
  | "heat_stress"
  | "frost_risk"
  | "disease_follow_up"
  | "heavy_rain_outdoor";

export type PlantAlert = {
  id: string;
  userId: number;
  plantId: string;
  plantName: string;
  alertType: AlertType;
  message: string;
  urgency: AlertUrgency;
  notified: boolean;
  triggeredAt: string;
};

export type ObserverResult = {
  alertsGenerated: number;
  alertsFired: number;
  alerts: PlantAlert[];
  skipped: boolean;
  skipReason?: string;
};

type AlertRow = {
  id: string;
  user_id: number;
  plant_id: string;
  plant_name: string;
  alert_type: string;
  message: string;
  urgency: string;
  notified: number;
  triggered_at: string;
};

type RawAlert = {
  plant_id: string;
  plant_name: string;
  alert_type: AlertType;
  message: string;
  urgency: AlertUrgency;
};

type SubscriptionRow = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

const OBSERVER_TOOLS: ChatToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "submit_alerts",
      description:
        "Submit the final list of anomalies detected. Only include plants that have a genuine, evidence-backed issue requiring immediate attention.",
      parameters: {
        type: "object",
        properties: {
          alerts: {
            type: "array",
            items: {
              type: "object",
              properties: {
                plant_id: { type: "string" },
                plant_name: { type: "string" },
                alert_type: {
                  type: "string",
                  enum: [
                    "overdue_watering",
                    "consecutive_skips",
                    "heat_stress",
                    "frost_risk",
                    "disease_follow_up",
                    "heavy_rain_outdoor",
                  ],
                },
                message: {
                  type: "string",
                  description:
                    "Short actionable message the user will receive. Max 120 chars. Be specific about evidence.",
                },
                urgency: {
                  type: "string",
                  enum: ["high", "medium", "low"],
                },
              },
              required: ["plant_id", "plant_name", "alert_type", "message", "urgency"],
            },
          },
        },
        required: ["alerts"],
      },
    },
  },
];

function buildObserverSystemPrompt(exposure: string, weatherAffected: boolean): string {
  const outdoorAlerts = weatherAffected
    ? `- heat_stress: temperature ≥ 37°C AND plant is outdoor
- frost_risk: frost risk flag is true AND plant is outdoor
- heavy_rain_outdoor: heavy rain flag AND outdoor plant that needs drainage attention`
    : `(Garden is indoor — do NOT raise frost_risk, heavy_rain_outdoor, or heat_stress from weather. Only raise heat_stress if room temperature is extreme.)`;

  return `You are BloomPilot's proactive alert observer. Garden exposure: ${exposure}.

Raise an alert when there is genuine, evidence-backed risk:
- overdue_watering: plant skipped 2+ times AND/OR watering interval clearly exceeded
- consecutive_skips: 3+ consecutive water skips with no watering in between
- disease_follow_up: plant was diagnosed in the last 14 days AND has had no care logged since
${outdoorAlerts}

Do NOT alert if:
- The plant has no health history (can't assess)
- Weather data is unavailable
- The situation is already covered by routine daily care

Call submit_alerts with ONLY genuine issues. An empty list is fine if nothing needs immediate attention.
Today's date: ${new Date().toISOString().slice(0, 10)}`;
}

function buildObserverUserPrompt(
  summaries: PlantHealthSummary[],
  context: Awaited<ReturnType<typeof buildGardenContext>>,
): string {
  const env = context.environment;

  const weatherText =
    env.temperature_c !== null
      ? `Temp: ${env.temperature_c}°C (high ${env.today_high_c ?? "?"}°C / low ${env.today_low_c ?? "?"}°C) | Humidity: ${env.humidity_percent}% | Dew point: ${env.dew_point_c ?? "?"}°C
Soil: ${env.soil_temperature_c ?? "?"}°C, moisture ${env.soil_moisture ?? "?"} | Wind: ${env.wind_speed_kph ?? 0}kph | UV: ${env.uv_index} | GDD: ${env.gdd_today ?? "?"}°C
Season: ${env.season} (${env.hemisphere}) | ${env.climate_zone ?? ""} | ${env.usda_zone ?? ""} | GDD: ${env.gdd_today ?? "?"}°C
Air quality: ${env.air_quality ? `ozone=${env.air_quality.ozone}, plant stress=${env.air_quality.plant_stress_risk}` : "unknown"}
Risks: heat=${env.risk_flags.heat_stress}, frost=${env.risk_flags.frost_risk}, heavy_rain=${env.risk_flags.heavy_rain}, high_uv=${env.risk_flags.high_uv}, high_wind=${env.risk_flags.high_wind}, disease=${env.risk_flags.disease_risk}`
      : "Weather data unavailable";

  const plantsText = context.plants
    .map((p) => {
      const summary = summaries.find((s) => s.plantId === p.plant_id);
      const historyText = summary
        ? `consecutiveSkips=${summary.consecutiveSkips}, waterCount=${summary.waterCount}, skipCount=${summary.skipCount}, lastWatered=${summary.lastWateredAt?.slice(0, 10) ?? "never"}, lastDiagnosis=${summary.lastDiagnosedAt?.slice(0, 10) ?? "none"}${summary.lastDiagnosisIssue ? ` (${summary.lastDiagnosisIssue})` : ""}`
        : "No health history recorded";
      return `- ID: ${p.plant_id} | ${p.common_name} | Placement: ${p.placement} | History: ${historyText}`;
    })
    .join("\n");

  return `Garden: ${context.garden.garden_type} in ${context.garden.location.input}

Weather now:
${weatherText}

Plants and health history:
${plantsText || "No plants added yet"}

Scan for anomalies and call submit_alerts.`;
}

async function persistAlerts(userId: number, rawAlerts: RawAlert[]): Promise<PlantAlert[]> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const todayDate = now.slice(0, 10);
  const ownedPlants = new Map(
    (await db.prepare(`SELECT id, nickname FROM plants WHERE user_id = ?`).all(userId) as { id: string; nickname: string }[])
      .map((plant) => [plant.id, plant.nickname]),
  );

  const persisted: PlantAlert[] = [];

  // Dedup: skip if an alert with same plant+type was already raised today
  const existsStmt = await db.prepare(
    `SELECT 1 FROM plant_alerts WHERE user_id = ? AND plant_id = ? AND alert_type = ? AND date(triggered_at) = ? LIMIT 1`,
  );

  for (const raw of rawAlerts) {
    const plantName = ownedPlants.get(raw.plant_id);
    if (!plantName) continue;
    const dup = await existsStmt.get(userId, raw.plant_id, raw.alert_type, todayDate);
    if (dup) continue;

    const id = crypto.randomUUID();
    await db.prepare(
      `INSERT INTO plant_alerts (id, user_id, plant_id, plant_name, alert_type, message, urgency, notified, triggered_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    ).run(id, userId, raw.plant_id, plantName, raw.alert_type, raw.message.trim().slice(0, 240), raw.urgency, now);

    persisted.push({
      id,
      userId,
      plantId: raw.plant_id,
      plantName,
      alertType: raw.alert_type,
      message: raw.message,
      urgency: raw.urgency,
      notified: false,
      triggeredAt: now,
    });
  }

  return persisted;
}

async function fireNotifications(
  userId: number,
  alerts: PlantAlert[],
  userEmail: string,
): Promise<number> {
  const db = await getDatabase();
  const urgent = alerts.filter((a) => a.urgency === "high");
  if (urgent.length === 0) return 0;

  const pushSubscriptions = await db
    .prepare(
      `SELECT endpoint, p256dh, auth FROM notification_subscriptions WHERE user_id = ? AND active = 1`,
    )
    .all(userId) as SubscriptionRow[];

  const payload = {
    subject: `BloomPilot Alert: ${urgent.length} plant${urgent.length > 1 ? "s" : ""} need attention`,
    title: "Garden Alert",
    message: `${urgent.length} urgent issue${urgent.length > 1 ? "s" : ""} detected in your garden`,
    items: urgent.map((a) => `${a.plantName}: ${a.message}`),
  };

  let fired = 0;

  // push
  if (pushSubscriptions.length > 0) {
    const results = await Promise.all(
      pushSubscriptions.map(async (subscription) => ({
        subscription,
        result: await sendWebPushReminder({
          subscription: subscription as PushSubscriptionRecord,
          payload,
        }),
      })),
    );
    for (const entry of results) {
      if (entry.result.error_code === "push_subscription_expired") {
        await deactivatePushSubscription({
          userId,
          endpoint: entry.subscription.endpoint,
        });
      }
    }
    if (results.some((entry) => entry.result.status === "sent")) {
      fired++;
    }
  }

  // email fallback if no push
  if (fired === 0 && userEmail) {
    const result = await sendEmailReminder({ to: userEmail, payload });
    if (result.status === "sent") fired++;
  }

  // mark notified
  if (fired > 0) {
    const ids = urgent.map(() => "?").join(",");
    await db.prepare(
      `UPDATE plant_alerts SET notified = 1 WHERE id IN (${ids})`,
    ).run(...urgent.map((a) => a.id));
  }

  return fired;
}

export async function runAlertObserver(userId: number, userEmail: string): Promise<ObserverResult> {
  const context = await buildGardenContext(userId);
  if (context.plants.length === 0) {
    return { alertsGenerated: 0, alertsFired: 0, alerts: [], skipped: true, skipReason: "No plants" };
  }

  const summaries = await getAllPlantHealthSummaries(userId);

  const messages: ChatMessage[] = [
    { role: "system", content: buildObserverSystemPrompt(context.garden.exposure, context.garden.weather_affected) },
    { role: "user", content: buildObserverUserPrompt(summaries, context) },
  ];

  let rawAlerts: RawAlert[] = [];

  const result = await requestOpenAIChat({
    messages,
    tools: OBSERVER_TOOLS,
    maxTokens: 1200,
  });

  const submitCall = result.toolCalls.find((tc) => tc.function.name === "submit_alerts");
  if (submitCall) {
    try {
      const args = JSON.parse(submitCall.function.arguments) as { alerts: RawAlert[] };
      rawAlerts = Array.isArray(args.alerts) ? args.alerts : [];
    } catch {
      rawAlerts = [];
    }
  }

  const alerts = await persistAlerts(userId, rawAlerts);
  const fired = await fireNotifications(userId, alerts, userEmail);

  return {
    alertsGenerated: alerts.length,
    alertsFired: fired,
    alerts,
    skipped: false,
  };
}

export async function readRecentAlerts(userId: number, limit = 20): Promise<PlantAlert[]> {
  const db = await getDatabase();
  const rows = await db
    .prepare(
      `SELECT * FROM plant_alerts
       WHERE user_id = ? AND datetime(triggered_at) >= datetime('now', '-14 days')
       ORDER BY datetime(triggered_at) DESC LIMIT ?`,
    )
    .all(userId, limit) as AlertRow[];

  return rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    plantId: row.plant_id,
    plantName: row.plant_name,
    alertType: row.alert_type as AlertType,
    message: row.message,
    urgency: row.urgency as AlertUrgency,
    notified: Boolean(row.notified),
    triggeredAt: row.triggered_at,
  }));
}

export async function readUnnotifiedAlerts(userId: number): Promise<PlantAlert[]> {
  const db = await getDatabase();
  const rows = await db
    .prepare(
      `SELECT * FROM plant_alerts WHERE user_id = ? AND notified = 0 ORDER BY datetime(triggered_at) DESC`,
    )
    .all(userId) as AlertRow[];

  return rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    plantId: row.plant_id,
    plantName: row.plant_name,
    alertType: row.alert_type as AlertType,
    message: row.message,
    urgency: row.urgency as AlertUrgency,
    notified: false,
    triggeredAt: row.triggered_at,
  }));
}
