import { NextResponse } from "next/server";
import { buildWorkspaceEnvelope } from "@/lib/agent-service";
import { readSession } from "@/lib/session";
import { withApiHandler } from "@/lib/api-handler";

export const GET = withApiHandler(async () => {
  const session = await readSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(await buildWorkspaceEnvelope());
});
