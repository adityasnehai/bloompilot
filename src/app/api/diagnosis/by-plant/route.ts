import { NextResponse, type NextRequest } from "next/server";
import { requireApiSession } from "@/lib/api-session";
import { readWorkspaceIdentityByEmail } from "@/lib/workspace-store";
import { getDatabase } from "@/lib/database";
import { withApiHandler } from "@/lib/api-handler";

type DiagnosisRow = {
  id: string;
  plant_id: string;
  issue: string;
  category: string;
  severity: string;
  confidence: number;
  summary: string;
  treatment_json: string;
  follow_up: string;
  created_at: string;
};

export const GET = withApiHandler(async (request: NextRequest) => {
  const { session, response } = await requireApiSession();
  if (!session || response) return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const identity = await readWorkspaceIdentityByEmail(session.email);
  if (!identity) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const plantId = request.nextUrl.searchParams.get("plantId");
  if (!plantId) {
    return NextResponse.json({ error: "plantId required" }, { status: 400 });
  }

  const db = await getDatabase();
  const rows = await db
    .prepare(
      `SELECT id, plant_id, issue, category, severity, confidence, summary,
              treatment_json, follow_up, created_at
       FROM diagnosis_runs
       WHERE user_id = ? AND plant_id = ?
       ORDER BY datetime(created_at) DESC
       LIMIT 6`,
    )
    .all(identity.id, plantId) as DiagnosisRow[];

  const diagnoses = rows.map((r) => ({
    id: r.id,
    plantId: r.plant_id,
    issue: r.issue,
    category: r.category,
    severity: r.severity,
    confidence: r.confidence,
    summary: r.summary,
    treatment: safeParseStringArray(r.treatment_json),
    followUp: r.follow_up,
    createdAt: r.created_at,
    photoUrl: `/api/diagnosis/photo/${r.id}`,
  }));

  return NextResponse.json({ diagnoses });
});

function safeParseStringArray(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}
