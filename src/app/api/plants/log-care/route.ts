import { NextResponse, type NextRequest } from "next/server";
import { requireApiSession } from "@/lib/api-session";
import { readWorkspaceIdentityByEmail } from "@/lib/workspace-store";
import { logHealthEvent, type HealthEventType } from "@/lib/plant-memory";
import { getDatabase } from "@/lib/database";

const VALID_EVENT_TYPES: HealthEventType[] = [
  "watered",
  "fertilized",
  "inspected",
  "care_note",
];

const EVENT_DETAIL: Record<HealthEventType, string> = {
  watered:       "Manually logged watering",
  fertilized:    "Manually logged fertilization",
  inspected:     "Manually logged inspection",
  care_note:     "Care note logged",
  water_skipped: "Watering skipped",
  weather_alert: "Weather alert",
  diagnosed:     "Diagnosis run",
};

export async function POST(request: NextRequest) {
  const { session, response } = await requireApiSession();
  if (!session || response) return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const identity = readWorkspaceIdentityByEmail(session.email);
  if (!identity) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null) as {
    plantId?: string;
    plantName?: string;
    eventType?: string;
    note?: string;
  } | null;

  if (!body || !body.plantId || !body.eventType) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (!VALID_EVENT_TYPES.includes(body.eventType as HealthEventType)) {
    return NextResponse.json({ error: "Invalid event type" }, { status: 400 });
  }

  const eventType = body.eventType as HealthEventType;
  const detail = body.note?.trim() || EVENT_DETAIL[eventType];
  const plant = getDatabase()
    .prepare(`SELECT nickname FROM plants WHERE id = ? AND user_id = ?`)
    .get(body.plantId, identity.id) as { nickname: string } | undefined;
  if (!plant) return NextResponse.json({ error: "Plant not found" }, { status: 404 });

  logHealthEvent(identity.id, body.plantId, plant.nickname, eventType, detail, {
    source: "manual",
    note: body.note ?? null,
  });

  // For watered events also update last_watered_at on the plant record
  if (eventType === "watered") {
    getDatabase()
      .prepare(`UPDATE plants SET last_watered_at = ? WHERE id = ? AND user_id = ?`)
      .run(new Date().toISOString(), body.plantId, identity.id);
  }

  return NextResponse.json({ ok: true });
}
