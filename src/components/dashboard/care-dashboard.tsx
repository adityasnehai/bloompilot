"use client";

import { CareDashboardView } from "@/components/dashboard/care-dashboard-view";
import type { CarePlanOutput } from "@/lib/care-plan-engine";
import type { ContextJson } from "@/lib/context-builder";
import type { PlantAlert } from "@/lib/alert-observer";
import type { ActivityEntry, CareTask } from "@/lib/garden";
import type { ReminderChannelReadiness } from "@/lib/reminders";

type CareDashboardProps = {
  context: ContextJson;
  carePlan: CarePlanOutput;
  alerts: PlantAlert[];
  overdueTasks: CareTask[];
  dueTodayTasks: CareTask[];
  upcomingTasks: CareTask[];
  allTasks: CareTask[];
  activities: ActivityEntry[];
  reminderReadiness: ReminderChannelReadiness | null;
};

export function CareDashboard(props: CareDashboardProps) {
  return (
    <CareDashboardView
      context={props.context}
      carePlan={props.carePlan}
      alerts={props.alerts}
      overdueTasks={props.overdueTasks}
      dueTodayTasks={props.dueTodayTasks}
      upcomingTasks={props.upcomingTasks}
      allTasks={props.allTasks}
      activities={props.activities}
      reminderReadiness={props.reminderReadiness}
    />
  );
}
