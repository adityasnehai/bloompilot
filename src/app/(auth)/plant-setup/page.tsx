import { completePlantSetupAction, skipOnboardingAction } from "@/app/actions";
import { AddPlantWorkflow } from "@/components/plants/add-plant-workflow";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  getPlacementDefaultFromGardenType,
  readGardenState,
} from "@/lib/garden";
import { requireSession } from "@/lib/session";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function PlantSetupPage() {
  const session = await requireSession();
  if (session.onboarded) {
    redirect("/dashboard");
  }

  const gardenState = await readGardenState();
  const defaultPlacement = getPlacementDefaultFromGardenType(session.gardenType);

  return (
    <div className="auth-onboarding plant-setup-page min-h-screen px-4 py-5 sm:py-8 lg:px-8">
      <Card className="auth-onboarding-shell mx-auto flex w-full max-w-6xl flex-col gap-7 px-4 py-4 sm:px-7 sm:py-7">
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/"
            aria-label="Back to home"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-lg text-white/70 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
          >
            ←
          </Link>
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">Garden setup</span>
        </div>

        <div className="max-w-2xl space-y-3">
          <p className="eyebrow">Your plant list</p>
          <h1 className="text-[2rem] font-semibold leading-[1.02] tracking-[-0.04em] text-white sm:text-[2.5rem]">
            Add the plants you care for.
          </h1>
          <p className="max-w-xl text-sm leading-6 text-white/55 sm:text-[15px]">
            Search by name or use a photo. Add each plant&apos;s placement so reminders fit its real conditions.
          </p>
        </div>

        <div className="grid gap-6">
          <AddPlantWorkflow
            initialPlants={gardenState.plants}
            defaultPlacement={defaultPlacement}
          />

          <div className="flex flex-col-reverse items-stretch gap-3 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <form action={skipOnboardingAction} className="sm:mr-auto">
              <Button type="submit" variant="ghost" className="h-10 w-full px-2 text-xs text-white/50 hover:text-white sm:w-auto">
                Skip for now
              </Button>
            </form>
            <form action={completePlantSetupAction}>
              <Button type="submit" className="h-11 w-full px-7 sm:w-auto">
                Continue to dashboard
              </Button>
            </form>
          </div>
        </div>
      </Card>
    </div>
  );
}
