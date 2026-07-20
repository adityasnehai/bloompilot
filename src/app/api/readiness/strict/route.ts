import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/api-session";
import { appConfig } from "@/lib/app-config";
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

  const identity = await readWorkspaceIdentityByEmail(session.email);
  if (!identity) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  let context = await readLatestContextSnapshot(identity.id);
  if (isGardenContextSnapshotStale(context)) {
    context = await buildGardenContext(identity.id);
  }

  if (!context) {
    return NextResponse.json({ error: "Context build failed" }, { status: 500 });
  }

  const providerHealth = {
    strict_mode: appConfig.strictProductionMode,
    plantnet_configured: Boolean(process.env.PLANTNET_API_KEY?.trim()),
    perenual_configured: Boolean(process.env.PERENUAL_API_KEY?.trim()),
    openai_configured: Boolean(process.env.OPENAI_API_KEY?.trim()),
  };

  const blockers = [
    ...context.warnings,
    ...(providerHealth.plantnet_configured
      ? []
      : [{ level: "high" as const, message: "PLANTNET_API_KEY missing." }]),
    ...(providerHealth.perenual_configured
      ? []
      : [{ level: "high" as const, message: "PERENUAL_API_KEY missing." }]),
    ...(providerHealth.openai_configured
      ? []
      : [{ level: "high" as const, message: "OPENAI_API_KEY missing; care planning cannot run." }]),
  ];

  const ready = appConfig.strictProductionMode ? context.agent_ready && blockers.length === 0 : true;

  return NextResponse.json({
    ready,
    strict_mode: appConfig.strictProductionMode,
    context_id: context.context_id,
    provider_health: providerHealth,
    blockers,
  });
}
