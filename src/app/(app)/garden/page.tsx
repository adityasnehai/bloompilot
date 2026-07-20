import { redirect } from "next/navigation";
import { AddPlantWorkflow } from "@/components/plants/add-plant-workflow";
import {
  getPlacementDefaultFromGardenType,
  readGardenState,
} from "@/lib/garden";
import { requireSession } from "@/lib/session";

export default async function GardenPage() {
  const session = await requireSession();

  if (!session.onboarded) {
    redirect("/onboarding");
  }

  const gardenState = await readGardenState();
  const defaultPlacement = getPlacementDefaultFromGardenType(session.gardenType);

  return (
    <div className="grid gap-6">
      <header className="border-b border-[var(--color-line)] pb-5">
        <p className="eyebrow">Plants</p>
        <h1 className="mt-2 text-2xl font-bold tracking-[-0.04em] text-[var(--color-ink)] lg:text-3xl">Your plant collection</h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--color-muted)]">
          Search for a plant or identify one from a photo, then manage the plants you have.
        </p>
      </header>

      <section className="min-w-0">
        <AddPlantWorkflow
          initialPlants={gardenState.plants}
          defaultPlacement={defaultPlacement}
        />
      </section>
    </div>
  );
}
