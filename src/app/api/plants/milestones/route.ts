import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/api-session";
import { readWorkspaceIdentityByEmail } from "@/lib/workspace-store";
import { getDatabase } from "@/lib/database";
import { randomUUID } from "node:crypto";

export const runtime = "nodejs";

const STAGES = ["seedling", "sprout", "growing", "mature", "flowering", "dormant"] as const;
type Stage = (typeof STAGES)[number];

type MilestoneRow = {
  id: string;
  plant_id: string;
  plant_name: string;
  stage: string;
  note: string | null;
  recorded_at: string;
};

export async function GET(req: NextRequest) {
  const { session, response } = await requireApiSession();
  if (!session || response) return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const identity = readWorkspaceIdentityByEmail(session.email);
  if (!identity) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const plantId = searchParams.get("plantId");
  if (!plantId) return NextResponse.json({ error: "plantId required" }, { status: 400 });

  const db = getDatabase();
  const rows = db
    .prepare(`SELECT id, plant_id, plant_name, stage, note, recorded_at FROM plant_milestones WHERE user_id = ? AND plant_id = ? ORDER BY datetime(recorded_at) DESC LIMIT 20`)
    .all(identity.id, plantId) as MilestoneRow[];

  return NextResponse.json({ milestones: rows });
}

export async function POST(req: NextRequest) {
  const { session, response } = await requireApiSession();
  if (!session || response) return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const identity = readWorkspaceIdentityByEmail(session.email);
  if (!identity) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: { plantId: string; plantName: string; stage: Stage; note?: string };
  try {
    body = (await req.json()) as { plantId: string; plantName: string; stage: Stage; note?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { plantId, plantName, stage, note } = body;

  if (!plantId || !plantName || !STAGES.includes(stage)) {
    return NextResponse.json({ error: "plantId, plantName, and valid stage required" }, { status: 400 });
  }

  const db = getDatabase();
  const id = randomUUID();
  const recordedAt = new Date().toISOString();

  db.prepare(
    `INSERT INTO plant_milestones (id, user_id, plant_id, plant_name, stage, note, recorded_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, identity.id, plantId, plantName, stage, note ?? null, recordedAt);

  return NextResponse.json({ milestone: { id, plantId, plantName, stage, note, recordedAt } });
}

export async function DELETE(req: NextRequest) {
  const { session, response } = await requireApiSession();
  if (!session || response) return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const identity = readWorkspaceIdentityByEmail(session.email);
  if (!identity) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const milestoneId = searchParams.get("milestoneId");
  if (!milestoneId) return NextResponse.json({ error: "milestoneId required" }, { status: 400 });

  const db = getDatabase();
  db.prepare(`DELETE FROM plant_milestones WHERE id = ? AND user_id = ?`).run(milestoneId, identity.id);

  return NextResponse.json({ ok: true });
}
