"use client";

import { CareDashboardView } from "@/components/dashboard/care-dashboard-view";
import type { CarePlanOutput } from "@/lib/care-plan-engine";
import type { ContextJson } from "@/lib/context-builder";
import type { PlantAlert } from "@/lib/alert-observer";

type CareDashboardProps = {
  context: ContextJson;
  carePlan: CarePlanOutput;
  alerts: PlantAlert[];
};

export function CareDashboard(props: CareDashboardProps) {
  return <CareDashboardView context={props.context} carePlan={props.carePlan} alerts={props.alerts} />;
}
