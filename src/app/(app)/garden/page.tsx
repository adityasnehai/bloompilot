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
      <section className="surface-panel px-5 py-6 sm:px-6">
        <p className="text-sm text-[var(--color-muted)]">Garden</p>
        <h2 className="mt-2 text-2xl font-semibold text-[var(--color-ink)]">Add plants</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
          Search by common name or upload a photo, then confirm placement, sunlight, soil and watering mode.
        </p>
        <div className="mt-6">
          <AddPlantWorkflow
            initialPlants={gardenState.plants}
            defaultPlacement={defaultPlacement}
          />
        </div>
      </section>
    </div>
  );
}
