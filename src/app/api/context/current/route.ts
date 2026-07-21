import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/api-session";
import {
  buildGardenContext,
  isGardenContextSnapshotStale,
  readLatestContextSnapshot,
} from "@/lib/context-builder";
import { readWorkspaceIdentityByEmail } from "@/lib/workspace-store";
import { withApiHandler } from "@/lib/api-handler";

export const GET = withApiHandler(async () => {
  const { session, response } = await requireApiSession();

  if (response) {
    return response;
  }

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const identity = await readWorkspaceIdentityByEmail(session.email);

  if (!identity) {
    return NextResponse.json({ context: null });
  }

  const snapshot = await readLatestContextSnapshot(identity.id);
  const context = isGardenContextSnapshotStale(snapshot)
    ? await buildGardenContext(identity.id)
    : snapshot;
  return NextResponse.json({ context });
});
