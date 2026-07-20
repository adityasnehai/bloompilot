import { NextResponse, type NextRequest } from "next/server";
import { requireApiSession } from "@/lib/api-session";
import { readWorkspaceIdentityByEmail } from "@/lib/workspace-store";
import { logActionFeedback, type FeedbackValue } from "@/lib/action-feedback";
import { getDatabase } from "@/lib/database";

export async function POST(request: NextRequest) {
  const { session, response } = await requireApiSession();
  if (!session || response) return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const identity = readWorkspaceIdentityByEmail(session.email);
  if (!identity) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  let body: {
    plantId?: string;
    plantName: string;
    actionType: string;
    actionTitle: string;
    feedback: FeedbackValue;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if ((body.feedback !== "positive" && body.feedback !== "negative") || !body.actionType || !body.actionTitle) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  let plantName = body.plantName?.trim() || "Garden";
  if (body.plantId) {
    const plant = getDatabase().prepare(`SELECT nickname FROM plants WHERE id = ? AND user_id = ?`).get(body.plantId, identity.id) as { nickname: string } | undefined;
    if (!plant) return NextResponse.json({ error: "Plant not found" }, { status: 404 });
    plantName = plant.nickname;
  }

  logActionFeedback(
    identity.id,
    body.plantId ?? null,
    plantName,
    body.actionType,
    body.actionTitle,
    body.feedback,
  );

  return NextResponse.json({ ok: true });
}
