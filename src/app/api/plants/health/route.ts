import { NextResponse, type NextRequest } from "next/server";
import { requireApiSession } from "@/lib/api-session";
import { readWorkspaceIdentityByEmail } from "@/lib/workspace-store";
import { getPlantHealthSummary, getPlantHealthHistory } from "@/lib/plant-memory";

export async function GET(request: NextRequest) {
  const { session, response } = await requireApiSession();
  if (!session || response) return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const plantId = request.nextUrl.searchParams.get("plantId");
  if (!plantId) {
    return NextResponse.json({ error: "plantId required" }, { status: 400 });
  }

  const identity = await readWorkspaceIdentityByEmail(session.email);
  if (!identity) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const summary = await getPlantHealthSummary(identity.id, plantId);
  const history = await getPlantHealthHistory(identity.id, plantId, 15);

  return NextResponse.json({ summary, history });
}
