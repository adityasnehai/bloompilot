import { redirect } from "next/navigation";
import Link from "next/link";
import { CareDashboard } from "@/components/dashboard/care-dashboard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { runCarePlanAgents } from "@/lib/agent-graph";
import { isCarePlanReasoningStale, readLatestCarePlan, type CarePlanOutput } from "@/lib/care-plan-engine";
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
import { getDueTodayTasks, getOverdueTasks, getUpcomingTasks, readGardenState } from "@/lib/garden";
import { readCurrentReminderChannelReadiness } from "@/lib/reminders";

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

  const identity = await readWorkspaceIdentityByEmail(session.email);
  const userId = identity?.id ?? (await upsertWorkspaceProfile(session));
  let context = await readLatestContextSnapshot(userId);

  if (isGardenContextSnapshotStale(context)) {
    context = await buildGardenContext(userId);
  }

  const activeContext = context ?? (await buildGardenContext(userId));
  let carePlan = await readLatestCarePlan(userId);

  if (!isCarePlanUsable(carePlan, activeContext.context_id) || isCarePlanReasoningStale(carePlan)) {
    try {
      carePlan = await runCarePlanAgents({
        userId,
        userEmail: session.email,
        trigger: "dashboard_load",
      });
    } catch {
      carePlan = null;
    }
  }

  if (!carePlan) {
    return (
      <main className="mx-auto grid min-h-[60vh] max-w-2xl place-items-center px-5 py-12">
        <Card as="section" className="w-full px-6 py-8 text-center">
          <p className="eyebrow">Care plan unavailable</p>
          <h1 className="mt-2 text-2xl font-semibold text-[var(--color-ink)]">Your garden data is safe</h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[var(--color-muted)]">
            BloomPilot could not generate today&apos;s recommendations. Check your garden setup or try again when the care service is available.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild>
              <Link href="/dashboard">Try again</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/settings">Check settings</Link>
            </Button>
          </div>
        </Card>
      </main>
    );
  }

  const alerts = await readRecentAlerts(userId, 10);
  const gardenState = await readGardenState();
  const reminderReadiness = await readCurrentReminderChannelReadiness();

  return (
    <CareDashboard
      context={activeContext}
      carePlan={carePlan}
      alerts={alerts}
      overdueTasks={getOverdueTasks(gardenState.tasks)}
      dueTodayTasks={getDueTodayTasks(gardenState.tasks)}
      upcomingTasks={getUpcomingTasks(gardenState.tasks, 7)}
      allTasks={gardenState.tasks}
      activities={gardenState.activities}
      reminderReadiness={reminderReadiness}
    />
  );
}
