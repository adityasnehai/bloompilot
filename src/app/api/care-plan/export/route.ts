import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/api-session";
import { readWorkspaceIdentityByEmail } from "@/lib/workspace-store";
import { getDatabase } from "@/lib/database";

export const runtime = "nodejs";

function csvRow(values: (string | number | null | undefined)[]) {
  return values
    .map((v) => {
      const s = v == null ? "" : String(v);
      return `"${s.replace(/"/g, '""')}"`;
    })
    .join(",");
}

export async function GET(req: NextRequest) {
  const { session, response } = await requireApiSession();
  if (!session || response) return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const identity = readWorkspaceIdentityByEmail(session.email);
  if (!identity) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const format = searchParams.get("format") ?? "csv";

  const db = getDatabase();

  type PlanRow = { id: string; generated_at: string; plan_json: string };
  const plans = db
    .prepare(`SELECT id, generated_at, plan_json FROM care_plans WHERE user_id = ? ORDER BY datetime(generated_at) DESC LIMIT 30`)
    .all(identity.id) as PlanRow[];

  if (format === "json") {
    const data = plans.map((row) => {
      try {
        return { id: row.id, generatedAt: row.generated_at, plan: JSON.parse(row.plan_json) };
      } catch {
        return { id: row.id, generatedAt: row.generated_at, plan: null };
      }
    });
    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": "attachment; filename=care-plan-history.json",
      },
    });
  }

  const rows: string[] = [
    csvRow(["Plan ID", "Generated At", "Health Score", "Total Plants", "Active Risks", "Today Actions", "Upcoming Tasks"]),
  ];

  for (const row of plans) {
    try {
      const plan = JSON.parse(row.plan_json) as {
        summary?: { health_score?: number; total_plants?: number; active_risks?: number };
        today_actions?: unknown[];
        upcoming_tasks?: unknown[];
      };
      rows.push(csvRow([
        row.id,
        row.generated_at,
        plan.summary?.health_score ?? 0,
        plan.summary?.total_plants ?? 0,
        plan.summary?.active_risks ?? 0,
        plan.today_actions?.length ?? 0,
        plan.upcoming_tasks?.length ?? 0,
      ]));
    } catch {
      rows.push(csvRow([row.id, row.generated_at, 0, 0, 0, 0, 0]));
    }
  }

  const csv = rows.join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=care-plan-history.csv",
    },
  });
}
