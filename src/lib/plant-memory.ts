import { getDatabase } from "@/lib/database";

export type HealthEventType =
  | "watered"
  | "water_skipped"
  | "inspected"
  | "fertilized"
  | "diagnosed"
  | "weather_alert"
  | "care_note";

export type HealthEvent = {
  id: string;
  userId: number;
  plantId: string;
  plantName: string;
  eventType: HealthEventType;
  detail: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

type HealthEventRow = {
  id: string;
  user_id: number;
  plant_id: string;
  plant_name: string;
  event_type: string;
  detail: string;
  metadata_json: string;
  created_at: string;
};

export type PlantHealthSummary = {
  plantId: string;
  plantName: string;
  recentEvents: HealthEvent[];
  skipCount: number;
  waterCount: number;
  lastWateredAt: string | null;
  lastDiagnosedAt: string | null;
  lastDiagnosisIssue: string | null;
  consecutiveSkips: number;
};

export function logHealthEvent(
  userId: number,
  plantId: string,
  plantName: string,
  eventType: HealthEventType,
  detail: string,
  metadata: Record<string, unknown> = {},
) {
  const db = getDatabase();
  db.prepare(
    `INSERT INTO plant_health_events (id, user_id, plant_id, plant_name, event_type, detail, metadata_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    crypto.randomUUID(),
    userId,
    plantId,
    plantName,
    eventType,
    detail,
    JSON.stringify(metadata),
    new Date().toISOString(),
  );
}

export function getPlantHealthHistory(
  userId: number,
  plantId: string,
  limit = 20,
): HealthEvent[] {
  const db = getDatabase();
  const rows = db
    .prepare(
      `SELECT * FROM plant_health_events
       WHERE user_id = ? AND plant_id = ?
       ORDER BY datetime(created_at) DESC
       LIMIT ?`,
    )
    .all(userId, plantId, limit) as HealthEventRow[];

  return rows.map(rowToEvent);
}

export function getGardenHealthHistory(userId: number, limit = 50): HealthEvent[] {
  const db = getDatabase();
  const rows = db
    .prepare(
      `SELECT * FROM plant_health_events
       WHERE user_id = ?
       ORDER BY datetime(created_at) DESC
       LIMIT ?`,
    )
    .all(userId, limit) as HealthEventRow[];

  return rows.map(rowToEvent);
}

export function getPlantHealthSummary(
  userId: number,
  plantId: string,
): PlantHealthSummary | null {
  const events = getPlantHealthHistory(userId, plantId, 30);

  if (events.length === 0) {
    return null;
  }

  const plantName = events[0].plantName;
  const waterCount = events.filter((e) => e.eventType === "watered").length;
  const skipCount = events.filter((e) => e.eventType === "water_skipped").length;

  const lastWatered = events.find((e) => e.eventType === "watered");
  const lastDiagnosed = events.find((e) => e.eventType === "diagnosed");

  // count consecutive skips from most recent event backwards
  let consecutiveSkips = 0;
  for (const event of events) {
    if (event.eventType === "water_skipped") {
      consecutiveSkips++;
    } else if (event.eventType === "watered") {
      break;
    }
  }

  return {
    plantId,
    plantName,
    recentEvents: events.slice(0, 10),
    waterCount,
    skipCount,
    lastWateredAt: lastWatered?.createdAt ?? null,
    lastDiagnosedAt: lastDiagnosed?.createdAt ?? null,
    lastDiagnosisIssue: lastDiagnosed
      ? (lastDiagnosed.metadata.issue as string | null) ?? null
      : null,
    consecutiveSkips,
  };
}

export function getAllPlantHealthSummaries(userId: number): PlantHealthSummary[] {
  const db = getDatabase();
  const plantIds = db
    .prepare(
      `SELECT DISTINCT plant_id FROM plant_health_events WHERE user_id = ?`,
    )
    .all(userId) as { plant_id: string }[];

  return plantIds
    .map(({ plant_id }) => getPlantHealthSummary(userId, plant_id))
    .filter((s): s is PlantHealthSummary => s !== null);
}

function rowToEvent(row: HealthEventRow): HealthEvent {
  return {
    id: row.id,
    userId: row.user_id,
    plantId: row.plant_id,
    plantName: row.plant_name,
    eventType: row.event_type as HealthEventType,
    detail: row.detail,
    metadata: safeParseObject(row.metadata_json),
    createdAt: row.created_at,
  };
}

function safeParseObject(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}
