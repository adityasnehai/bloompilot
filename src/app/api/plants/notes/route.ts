import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/lib/api-session";
import { readWorkspaceIdentityByEmail } from "@/lib/workspace-store";
import { addPlantNote, deletePlantNote, getPlantNotes } from "@/lib/plant-notes";
import { getDatabase } from "@/lib/database";
import { withApiHandler, parseJsonBody } from "@/lib/api-handler";

const noteSchema = z.object({
  plantId: z.string().optional(),
  plantName: z.string().optional(),
  body: z.string().optional(),
});

export const GET = withApiHandler(async (request: NextRequest) => {
  const { session, response } = await requireApiSession();
  if (!session || response) return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const identity = await readWorkspaceIdentityByEmail(session.email);
  if (!identity) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  const plantId = request.nextUrl.searchParams.get("plantId");
  if (!plantId) return NextResponse.json({ error: "plantId required" }, { status: 400 });

  return NextResponse.json({ notes: await getPlantNotes(identity.id, plantId) });
});

export const POST = withApiHandler(async (request: NextRequest) => {
  const { session, response } = await requireApiSession();
  if (!session || response) return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const identity = await readWorkspaceIdentityByEmail(session.email);
  if (!identity) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  const parsed = await parseJsonBody(request, noteSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  if (!body.plantId || !body.body?.trim()) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const db = await getDatabase();
  const plant = await db.prepare(`SELECT nickname FROM plants WHERE id = ? AND user_id = ?`).get(body.plantId, identity.id) as { nickname: string } | undefined;
  if (!plant) return NextResponse.json({ error: "Plant not found" }, { status: 404 });

  const note = await addPlantNote(identity.id, body.plantId, plant.nickname, body.body);
  return NextResponse.json({ note });
});

export const DELETE = withApiHandler(async (request: NextRequest) => {
  const { session, response } = await requireApiSession();
  if (!session || response) return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const identity = await readWorkspaceIdentityByEmail(session.email);
  if (!identity) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  const noteId = request.nextUrl.searchParams.get("noteId");
  if (!noteId) return NextResponse.json({ error: "noteId required" }, { status: 400 });

  const deleted = await deletePlantNote(identity.id, noteId);
  return NextResponse.json({ ok: deleted });
});
