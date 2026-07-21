import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/api-session";
import { readWorkspaceIdentityByEmail } from "@/lib/workspace-store";
import { getDatabase } from "@/lib/database";
import { withApiHandler } from "@/lib/api-handler";

export const runtime = "nodejs";

type PlanRow = { id: string; generated_at: string; plan_json: string };

export const GET = withApiHandler(async (
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) => {
  const { session, response } = await requireApiSession();
  if (!session || response) return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const identity = await readWorkspaceIdentityByEmail(session.email);
  if (!identity) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { id } = await context.params;

  const db = await getDatabase();
  const row = await db
    .prepare(`SELECT id, generated_at, plan_json FROM care_plans WHERE id = ? AND user_id = ?`)
    .get(id, identity.id) as PlanRow | undefined;

  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    return NextResponse.json({ id: row.id, generatedAt: row.generated_at, plan: JSON.parse(row.plan_json) });
  } catch {
    return NextResponse.json({ error: "Malformed plan" }, { status: 500 });
  }
});
