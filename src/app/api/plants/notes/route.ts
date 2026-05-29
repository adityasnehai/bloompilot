import { NextResponse, type NextRequest } from "next/server";
import { requireApiSession } from "@/lib/api-session";
import { readWorkspaceIdentityByEmail } from "@/lib/workspace-store";
import { addPlantNote, deletePlantNote, getPlantNotes } from "@/lib/plant-notes";

export async function GET(request: NextRequest) {
  const { session, response } = await requireApiSession();
  if (!session || response) return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const identity = readWorkspaceIdentityByEmail(session.email);
  if (!identity) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  const plantId = request.nextUrl.searchParams.get("plantId");
  if (!plantId) return NextResponse.json({ error: "plantId required" }, { status: 400 });

  return NextResponse.json({ notes: getPlantNotes(identity.id, plantId) });
}

export async function POST(request: NextRequest) {
  const { session, response } = await requireApiSession();
  if (!session || response) return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const identity = readWorkspaceIdentityByEmail(session.email);
  if (!identity) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  const body = (await request.json()) as { plantId: string; plantName: string; body: string };
  if (!body.plantId || !body.plantName || !body.body?.trim()) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const note = addPlantNote(identity.id, body.plantId, body.plantName, body.body);
  return NextResponse.json({ note });
}

export async function DELETE(request: NextRequest) {
  const { session, response } = await requireApiSession();
  if (!session || response) return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const identity = readWorkspaceIdentityByEmail(session.email);
  if (!identity) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  const noteId = request.nextUrl.searchParams.get("noteId");
  if (!noteId) return NextResponse.json({ error: "noteId required" }, { status: 400 });

  const deleted = deletePlantNote(identity.id, noteId);
  return NextResponse.json({ ok: deleted });
}
