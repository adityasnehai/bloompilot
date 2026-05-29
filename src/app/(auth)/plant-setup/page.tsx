import { completePlantSetupAction, skipOnboardingAction } from "@/app/actions";
import { AddPlantWorkflow } from "@/components/plants/add-plant-workflow";
import {
  getPlacementDefaultFromGardenType,
  readGardenState,
} from "@/lib/garden";
import { requireSession } from "@/lib/session";
import Link from "next/link";

export default async function PlantSetupPage() {
  const session = await requireSession();
  const gardenState = await readGardenState();
  const defaultPlacement = getPlacementDefaultFromGardenType(session.gardenType);

  return (
    <div className="landing-root px-4 py-8 lg:px-6">
      <section className="mx-auto w-full max-w-[920px] rounded-[28px] border border-[rgba(220,231,218,0.9)] bg-[linear-gradient(180deg,rgba(255,255,255,0.94)_0%,rgba(244,248,241,0.96)_100%)] px-6 py-6 shadow-[0_18px_40px_rgba(48,65,22,0.07)] sm:px-8 sm:py-8">
        <div className="flex flex-col gap-7">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <Link
                href="/"
                className="font-accent inline-flex items-center gap-2 text-sm font-medium text-[#62786b] transition hover:text-[#173528]"
              >
                <span className="text-base leading-none">←</span>
                Back to home
              </Link>
              <Link
                href="/"
                className="font-accent block text-[1.15rem] font-semibold leading-none text-[#173528] sm:text-[1.25rem]"
              >
                BloomPilot
              </Link>
            </div>
            <form action={skipOnboardingAction}>
              <button type="submit" className="button-secondary min-h-[2.4rem] px-4">
                Skip
              </button>
            </form>
          </div>

          <div className="max-w-2xl space-y-2">
            <p className="eyebrow">Plants</p>
            <h1 className="font-accent text-[2rem] font-semibold leading-[1.02] text-[#173528] sm:text-[2.3rem]">
              Add plants to your garden.
            </h1>
            <p className="landing-copy text-[15px]">
              Search by plant name or upload a photo, then confirm details before continuing.
            </p>
          </div>

          <div className="grid gap-5">
            <AddPlantWorkflow
              initialPlants={gardenState.plants}
              defaultPlacement={defaultPlacement}
            />

            <div className="flex flex-wrap gap-3 pt-1">
              <form action={completePlantSetupAction}>
                <button type="submit" className="button-primary min-h-[2.6rem] rounded-full px-7">
                  Continue
                </button>
              </form>
              <form action={skipOnboardingAction}>
                <button type="submit" className="button-secondary min-h-[2.6rem] rounded-full px-7">
                  Skip for now
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
