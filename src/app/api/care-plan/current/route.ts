import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/api-session";
import { readLatestCarePlan } from "@/lib/care-plan-engine";
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
    return NextResponse.json({ care_plan: null });
  }

  return NextResponse.json({ care_plan: readLatestCarePlan(identity.id) });
}
