import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/api-session";
import { readWorkspaceIdentityByEmail } from "@/lib/workspace-store";
import { getDatabase } from "@/lib/database";

export const runtime = "nodejs";

type HistoryRow = {
  id: string;
  generated_at: string;
  plan_json: string;
};

export async function GET() {
  const { session, response } = await requireApiSession();
  if (!session || response) return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const identity = await readWorkspaceIdentityByEmail(session.email);
  if (!identity) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const db = await getDatabase();
  const rows = await db
    .prepare(
      `SELECT id, generated_at, plan_json
       FROM care_plans WHERE user_id = ?
       ORDER BY datetime(generated_at) DESC
       LIMIT 30`,
    )
    .all(identity.id) as HistoryRow[];

  const plans = rows.map((row) => {
    try {
      const plan = JSON.parse(row.plan_json) as {
        summary?: { health_score?: number; total_plants?: number; active_risks?: number };
        today_actions?: unknown[];
        upcoming_tasks?: unknown[];
      };
      return {
        id: row.id,
        generatedAt: row.generated_at,
        healthScore: plan.summary?.health_score ?? 0,
        totalPlants: plan.summary?.total_plants ?? 0,
        activeRisks: plan.summary?.active_risks ?? 0,
        todayActionsCount: plan.today_actions?.length ?? 0,
        upcomingTasksCount: plan.upcoming_tasks?.length ?? 0,
      };
    } catch {
      return {
        id: row.id,
        generatedAt: row.generated_at,
        healthScore: 0,
        totalPlants: 0,
        activeRisks: 0,
        todayActionsCount: 0,
        upcomingTasksCount: 0,
      };
    }
  });

  return NextResponse.json({ plans });
}
