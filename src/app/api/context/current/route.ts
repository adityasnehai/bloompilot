import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/api-session";
import {
  buildGardenContext,
  isGardenContextSnapshotStale,
  readLatestContextSnapshot,
} from "@/lib/context-builder";
import { readWorkspaceIdentityByEmail } from "@/lib/workspace-store";

export async function GET() {
  const { session, response } = await requireApiSession();

  if (response) {
    return response;
  }

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const identity = readWorkspaceIdentityByEmail(session.email);

  if (!identity) {
    return NextResponse.json({ context: null });
  }

  const snapshot = readLatestContextSnapshot(identity.id);
  const context = isGardenContextSnapshotStale(snapshot)
    ? await buildGardenContext(identity.id)
    : snapshot;
  return NextResponse.json({ context });
}
