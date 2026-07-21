import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/lib/api-session";
import { readWorkspaceIdentityByEmail } from "@/lib/workspace-store";
import { getDatabase } from "@/lib/database";
import { randomUUID } from "node:crypto";
import { withApiHandler, parseJsonBody } from "@/lib/api-handler";

export const runtime = "nodejs";

const STAGES = ["seedling", "sprout", "growing", "mature", "flowering", "dormant"] as const;

type MilestoneRow = {
  id: string;
  plant_id: string;
  plant_name: string;
  stage: string;
  note: string | null;
  recorded_at: string;
};

const milestonePostSchema = z.object({
  plantId: z.string().optional(),
  stage: z.enum(STAGES).optional(),
  note: z.string().optional(),
});

export const GET = withApiHandler(async (req: NextRequest) => {
  const { session, response } = await requireApiSession();
  if (!session || response) return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const identity = await readWorkspaceIdentityByEmail(session.email);
  if (!identity) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const plantId = searchParams.get("plantId");
  if (!plantId) return NextResponse.json({ error: "plantId required" }, { status: 400 });

  const db = await getDatabase();
  const rows = await db
    .prepare(`SELECT id, plant_id, plant_name, stage, note, recorded_at FROM plant_milestones WHERE user_id = ? AND plant_id = ? ORDER BY datetime(recorded_at) DESC LIMIT 20`)
    .all(identity.id, plantId) as MilestoneRow[];

  return NextResponse.json({ milestones: rows });
});

export const POST = withApiHandler(async (req: NextRequest) => {
  const { session, response } = await requireApiSession();
  if (!session || response) return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const identity = await readWorkspaceIdentityByEmail(session.email);
  if (!identity) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = await parseJsonBody(req, milestonePostSchema);
  if (!parsed.ok) return parsed.response;
  const { plantId, stage, note } = parsed.data;

  if (!plantId || !stage || !STAGES.includes(stage)) {
    return NextResponse.json({ error: "plantId and valid stage required" }, { status: 400 });
  }

  const db = await getDatabase();
  const plant = await db.prepare(`SELECT nickname FROM plants WHERE id = ? AND user_id = ?`).get(plantId, identity.id) as { nickname: string } | undefined;
  if (!plant) return NextResponse.json({ error: "Plant not found" }, { status: 404 });
  const id = randomUUID();
  const recordedAt = new Date().toISOString();

  await db.prepare(
    `INSERT INTO plant_milestones (id, user_id, plant_id, plant_name, stage, note, recorded_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, identity.id, plantId, plant.nickname, stage, note?.trim().slice(0, 500) || null, recordedAt);

  return NextResponse.json({ milestone: { id, plantId, plantName: plant.nickname, stage, note: note?.trim().slice(0, 500) || undefined, recordedAt } });
});

export const DELETE = withApiHandler(async (req: NextRequest) => {
  const { session, response } = await requireApiSession();
  if (!session || response) return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const identity = await readWorkspaceIdentityByEmail(session.email);
  if (!identity) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const milestoneId = searchParams.get("milestoneId");
  if (!milestoneId) return NextResponse.json({ error: "milestoneId required" }, { status: 400 });

  const db = await getDatabase();
  await db.prepare(`DELETE FROM plant_milestones WHERE id = ? AND user_id = ?`).run(milestoneId, identity.id);

  return NextResponse.json({ ok: true });
});
