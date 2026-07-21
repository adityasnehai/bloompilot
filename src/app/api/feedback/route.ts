import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/lib/api-session";
import { readWorkspaceIdentityByEmail } from "@/lib/workspace-store";
import { logActionFeedback } from "@/lib/action-feedback";
import { getDatabase } from "@/lib/database";
import { withApiHandler, parseJsonBody } from "@/lib/api-handler";

const feedbackSchema = z.object({
  plantId: z.string().optional(),
  plantName: z.string().optional(),
  actionType: z.string().min(1),
  actionTitle: z.string().min(1),
  feedback: z.enum(["positive", "negative"]),
});

export const POST = withApiHandler(async (request: NextRequest) => {
  const { session, response } = await requireApiSession();
  if (!session || response) return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const identity = await readWorkspaceIdentityByEmail(session.email);
  if (!identity) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const parsed = await parseJsonBody(request, feedbackSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  let plantName = body.plantName?.trim() || "Garden";
  if (body.plantId) {
    const db = await getDatabase();
    const plant = await db.prepare(`SELECT nickname FROM plants WHERE id = ? AND user_id = ?`).get(body.plantId, identity.id) as { nickname: string } | undefined;
    if (!plant) return NextResponse.json({ error: "Plant not found" }, { status: 404 });
    plantName = plant.nickname;
  }

  await logActionFeedback(
    identity.id,
    body.plantId ?? null,
    plantName,
    body.actionType,
    body.actionTitle,
    body.feedback,
  );

  return NextResponse.json({ ok: true });
});
