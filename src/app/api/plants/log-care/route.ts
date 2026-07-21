import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/lib/api-session";
import { readWorkspaceIdentityByEmail } from "@/lib/workspace-store";
import { logHealthEvent, type HealthEventType } from "@/lib/plant-memory";
import { getDatabase } from "@/lib/database";
import { withApiHandler, parseJsonBody } from "@/lib/api-handler";

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

const logCareSchema = z.object({
  plantId: z.string().optional(),
  plantName: z.string().optional(),
  eventType: z.string().optional(),
  note: z.string().optional(),
});

export const POST = withApiHandler(async (request: NextRequest) => {
  const { session, response } = await requireApiSession();
  if (!session || response) return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const identity = await readWorkspaceIdentityByEmail(session.email);
  if (!identity) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const parsed = await parseJsonBody(request, logCareSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  if (!body.plantId || !body.eventType) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (!VALID_EVENT_TYPES.includes(body.eventType as HealthEventType)) {
    return NextResponse.json({ error: "Invalid event type" }, { status: 400 });
  }

  const eventType = body.eventType as HealthEventType;
  const detail = body.note?.trim() || EVENT_DETAIL[eventType];
  const db = await getDatabase();
  const plant = await db
    .prepare(`SELECT nickname FROM plants WHERE id = ? AND user_id = ?`)
    .get(body.plantId, identity.id) as { nickname: string } | undefined;
  if (!plant) return NextResponse.json({ error: "Plant not found" }, { status: 404 });

  await logHealthEvent(identity.id, body.plantId, plant.nickname, eventType, detail, {
    source: "manual",
    note: body.note ?? null,
  });

  // For watered events also update last_watered_at on the plant record
  if (eventType === "watered") {
    await db
      .prepare(`UPDATE plants SET last_watered_at = ? WHERE id = ? AND user_id = ?`)
      .run(new Date().toISOString(), body.plantId, identity.id);
  }

  return NextResponse.json({ ok: true });
});
