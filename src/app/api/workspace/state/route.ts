import { NextResponse } from "next/server";
import { buildWorkspaceEnvelope } from "@/lib/agent-service";
import { readSession } from "@/lib/session";

export async function GET() {
  const session = await readSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(await buildWorkspaceEnvelope());
}
