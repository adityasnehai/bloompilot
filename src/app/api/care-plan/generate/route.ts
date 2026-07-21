import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/api-session";
import { appConfig } from "@/lib/app-config";
import {
  buildGardenContext,
  isGardenContextSnapshotStale,
  readLatestContextSnapshot,
} from "@/lib/context-builder";
import { runCarePlanAgents } from "@/lib/agent-graph";
import { readWorkspaceIdentityByEmail } from "@/lib/workspace-store";
import { withApiHandler, rateLimitedResponse } from "@/lib/api-handler";
import { checkRateLimit } from "@/lib/rate-limit";

export const POST = withApiHandler(async () => {
  const { session, response } = await requireApiSession();

  if (response) {
    return response;
  }

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Each call runs a real LLM tool-calling loop (up to 10 iterations) — cap how
  // often one account can trigger it.
  const limit = await checkRateLimit("care_plan_generate", session.email, 6, 300);
  if (limit.limited) return rateLimitedResponse(limit.retryAfterSeconds);

  const identity = await readWorkspaceIdentityByEmail(session.email);
  if (!identity) {
    return NextResponse.json(
      { error: "Profile not found for current session" },
      { status: 404 },
    );
  }

  let context = await readLatestContextSnapshot(identity.id);
  if (isGardenContextSnapshotStale(context)) {
    context = await buildGardenContext(identity.id);
  }

  if (!context) {
    return NextResponse.json({ error: "Context build failed" }, { status: 500 });
  }

  if (appConfig.strictProductionMode && !context.agent_ready) {
    return NextResponse.json(
      {
        error: "Strict mode blocked care-plan generation. Fix missing evidence first.",
        blockers: context.warnings,
        context_id: context.context_id,
      },
      { status: 422 },
    );
  }

  let carePlan;
  try {
    carePlan = await runCarePlanAgents({
      userId: identity.id,
      userEmail: session.email,
      trigger: "api_generate",
    });
  } catch {
    return NextResponse.json({ error: "Care planning service unavailable" }, { status: 503 });
  }

  return NextResponse.json({ care_plan: carePlan });
});
