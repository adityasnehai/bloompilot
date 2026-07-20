import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/api-session";
import { readWorkspaceIdentityByEmail } from "@/lib/workspace-store";
import { runAlertObserver, readRecentAlerts } from "@/lib/alert-observer";

export async function GET() {
  const { session, response } = await requireApiSession();
  if (!session || response) return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const identity = readWorkspaceIdentityByEmail(session.email);
  if (!identity) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const alerts = readRecentAlerts(identity.id, 30);
  return NextResponse.json({ alerts });
}

export async function POST() {
  const { session, response } = await requireApiSession();
  if (!session || response) return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const identity = readWorkspaceIdentityByEmail(session.email);
  if (!identity) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  try {
    const result = await runAlertObserver(identity.id, session.email);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Alert service unavailable" }, { status: 503 });
  }
}
