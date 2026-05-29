import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/api-session";
import { readWorkspaceIdentityByEmail } from "@/lib/workspace-store";
import { getDatabase } from "@/lib/database";

export const runtime = "nodejs";

const MAX_BYTES = 4 * 1024 * 1024;

// POST /api/plants/photo?plantId=xxx  (multipart: photo field)
export async function POST(request: NextRequest) {
  const { session, response } = await requireApiSession();
  if (!session || response) return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const identity = readWorkspaceIdentityByEmail(session.email);
  if (!identity) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const plantId = request.nextUrl.searchParams.get("plantId");
  if (!plantId) return NextResponse.json({ error: "plantId required" }, { status: 400 });

  const formData = await request.formData();
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "photo file required" }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Must be an image" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image too large (max 4 MB)" }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const db = getDatabase();

  const result = db
    .prepare(`UPDATE plants SET photo_blob = ?, photo_type = ? WHERE id = ? AND user_id = ?`)
    .run(bytes, file.type, plantId, identity.id);

  if ((result as { changes: number }).changes === 0) {
    return NextResponse.json({ error: "Plant not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, photoUrl: `/api/plants/photo?plantId=${plantId}` });
}

// HEAD /api/plants/photo?plantId=xxx  (used by client to check existence without downloading)
export async function HEAD(request: NextRequest) {
  const { session, response } = await requireApiSession();
  if (!session || response) return new Response(null, { status: 401 });

  const identity = readWorkspaceIdentityByEmail(session.email);
  if (!identity) return new Response(null, { status: 404 });

  const plantId = request.nextUrl.searchParams.get("plantId");
  if (!plantId) return new Response(null, { status: 400 });

  const db = getDatabase();
  const row = db
    .prepare(`SELECT 1 FROM plants WHERE id = ? AND user_id = ? AND photo_blob IS NOT NULL`)
    .get(plantId, identity.id);

  return new Response(null, { status: row ? 200 : 404 });
}

// GET /api/plants/photo?plantId=xxx
export async function GET(request: NextRequest) {
  const { session, response } = await requireApiSession();
  if (!session || response) return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const identity = readWorkspaceIdentityByEmail(session.email);
  if (!identity) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const plantId = request.nextUrl.searchParams.get("plantId");
  if (!plantId) return NextResponse.json({ error: "plantId required" }, { status: 400 });

  const db = getDatabase();
  const row = db
    .prepare(`SELECT photo_blob, photo_type FROM plants WHERE id = ? AND user_id = ?`)
    .get(plantId, identity.id) as { photo_blob: Uint8Array | null; photo_type: string | null } | undefined;

  if (!row?.photo_blob) return NextResponse.json({ error: "No photo" }, { status: 404 });

  return new Response(Buffer.from(row.photo_blob), {
    headers: {
      "Content-Type": row.photo_type ?? "image/jpeg",
      "Cache-Control": "private, max-age=86400",
    },
  });
}

// DELETE /api/plants/photo?plantId=xxx
export async function DELETE(request: NextRequest) {
  const { session, response } = await requireApiSession();
  if (!session || response) return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const identity = readWorkspaceIdentityByEmail(session.email);
  if (!identity) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const plantId = request.nextUrl.searchParams.get("plantId");
  if (!plantId) return NextResponse.json({ error: "plantId required" }, { status: 400 });

  const db = getDatabase();
  db.prepare(`UPDATE plants SET photo_blob = NULL, photo_type = NULL WHERE id = ? AND user_id = ?`)
    .run(plantId, identity.id);

  return NextResponse.json({ ok: true });
}
