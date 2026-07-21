import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/api-session";
import { readLatestCarePlan } from "@/lib/care-plan-engine";
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
    return NextResponse.json({ care_plan: null });
  }

  return NextResponse.json({ care_plan: await readLatestCarePlan(identity.id) });
});
