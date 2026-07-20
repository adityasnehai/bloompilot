import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/api-session";
import { buildGardenContext } from "@/lib/context-builder";
import { readWorkspaceIdentityByEmail } from "@/lib/workspace-store";

export async function POST() {
  const { session, response } = await requireApiSession();

  if (response) {
    return response;
  }

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const identity = await readWorkspaceIdentityByEmail(session.email);

  if (!identity) {
    return NextResponse.json(
      { error: "Profile not found for current session" },
      { status: 404 },
    );
  }

  const context = await buildGardenContext(identity.id);
  return NextResponse.json({ context });
}
