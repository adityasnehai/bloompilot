import { redirect } from "next/navigation";
import { CareDashboard } from "@/components/dashboard/care-dashboard";
import { runCarePlanAgents } from "@/lib/agent-graph";
import { readLatestCarePlan, type CarePlanOutput } from "@/lib/care-plan-engine";
import {
  buildGardenContext,
  isGardenContextSnapshotStale,
  readLatestContextSnapshot,
} from "@/lib/context-builder";
import { requireSession } from "@/lib/session";
import {
  readWorkspaceIdentityByEmail,
  upsertWorkspaceProfile,
} from "@/lib/workspace-store";
import { readRecentAlerts } from "@/lib/alert-observer";

function isCarePlanUsable(carePlan: CarePlanOutput | null, contextId: string) {
  return Boolean(
    carePlan &&
      carePlan.context_id === contextId &&
      Array.isArray(carePlan.watering_forecast) &&
      Array.isArray(carePlan.weather_risk_forecast) &&
      Array.isArray(carePlan.care_calendar) &&
      Array.isArray(carePlan.setup_mismatches) &&
      Array.isArray(carePlan.reminder_readiness),
  );
}

export default async function DashboardPage() {
  const session = await requireSession();

  if (!session.onboarded) {
    redirect("/onboarding");
  }

  const identity = readWorkspaceIdentityByEmail(session.email);
  const userId = identity?.id ?? upsertWorkspaceProfile(session);
  let context = readLatestContextSnapshot(userId);

  if (isGardenContextSnapshotStale(context)) {
    context = await buildGardenContext(userId);
  }

  const activeContext = context ?? (await buildGardenContext(userId));
  let carePlan = readLatestCarePlan(userId);

  if (!isCarePlanUsable(carePlan, activeContext.context_id)) {
    carePlan = await runCarePlanAgents({
      userId,
      userEmail: session.email,
      trigger: "dashboard_load",
    });
  }

  if (!carePlan) {
    throw new Error("Care plan generation failed");
  }

  const alerts = readRecentAlerts(userId, 10);

  return <CareDashboard context={activeContext} carePlan={carePlan} alerts={alerts} />;
}
