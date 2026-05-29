import { ReactNode } from "react";
import { createDiagnosisAction } from "@/app/diagnosis-actions";
import { AppTopNav } from "@/components/layout/app-top-nav";
import { BrandMark } from "@/components/brand-mark";
import { AddPlantWorkflow } from "@/components/plants/add-plant-workflow";
import { SelectField } from "@/components/forms/select-field";
import { TextareaField } from "@/components/forms/textarea-field";
import { signOutAction } from "@/app/actions";
import {
  getPlacementDefaultFromGardenType,
  readGardenState,
} from "@/lib/garden";
import type { DemoSession } from "@/lib/session";

type AppShellProps = {
  children: ReactNode;
  session: DemoSession;
};

export async function AppShell({ children, session }: AppShellProps) {
  const gardenState = await readGardenState();
  const defaultPlacement = getPlacementDefaultFromGardenType(session.gardenType);

  return (
    <div className="mx-auto min-h-screen max-w-[1240px] px-4 py-4 lg:px-6">
      <header className="sticky top-2 z-30 mb-4 rounded-lg border border-[var(--color-line)] bg-[rgba(255,255,255,0.94)] px-4 py-3 shadow-[0_10px_26px_rgba(20,52,39,0.08)] backdrop-blur-md">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <BrandMark compact />
          <AppTopNav />

          <div className="flex flex-wrap items-center gap-2 xl:justify-end">
            <details className="relative">
              <summary className="button-primary min-h-10 cursor-pointer list-none rounded-lg px-4 whitespace-nowrap [&::-webkit-details-marker]:hidden">
                Add plant
              </summary>
              <div className="mt-3 max-h-[82vh] w-[min(92vw,860px)] overflow-y-auto rounded-lg border border-[var(--color-line)] bg-white p-4 shadow-[0_18px_50px_rgba(20,52,39,0.14)] md:absolute md:right-0 md:top-11 md:z-50 md:mt-0">
                <div className="mb-4">
                  <p className="text-sm font-semibold text-[var(--color-ink)]">
                    Add plants to your garden
                  </p>
                  <p className="mt-1 text-sm text-[var(--color-muted)]">
                    Search by name or upload a photo, then confirm setup details.
                  </p>
                </div>
                <AddPlantWorkflow
                  initialPlants={gardenState.plants}
                  defaultPlacement={defaultPlacement}
                  refreshOnChange
                />
              </div>
            </details>
            <details className="relative">
              <summary className="button-secondary min-h-10 cursor-pointer list-none rounded-lg px-4 whitespace-nowrap [&::-webkit-details-marker]:hidden">
                Disease scan
              </summary>
              <div className="mt-3 w-[min(92vw,460px)] rounded-lg border border-[var(--color-line)] bg-white p-4 shadow-[0_18px_50px_rgba(20,52,39,0.14)] md:absolute md:right-0 md:top-11 md:z-50 md:mt-0">
                <p className="text-sm font-semibold text-[var(--color-ink)]">Upload plant photo</p>
                <p className="mt-1 text-sm text-[var(--color-muted)]">
                  Run disease analysis and attach the result to a tracked plant.
                </p>
                {gardenState.plants.length > 0 ? (
                  <form action={createDiagnosisAction} className="mt-4 grid gap-4">
                    <input type="hidden" name="returnTo" value="/dashboard" />
                    <SelectField
                      label="Plant"
                      name="plantId"
                      defaultValue={gardenState.plants[0]?.id}
                      options={gardenState.plants.map((plant) => ({
                        label: `${plant.nickname} · ${plant.species}`,
                        value: plant.id,
                      }))}
                    />
                    <label className="flex flex-col gap-2">
                      <span className="field-label">Plant photo</span>
                      <input
                        type="file"
                        name="photo"
                        accept="image/*"
                        required
                        className="field-control file:mr-4 file:rounded-2xl file:border-0 file:bg-[var(--color-canopy)] file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-[var(--color-moss)]"
                      />
                    </label>
                    <TextareaField
                      label="Observation"
                      name="observation"
                      placeholder="Yellow leaves, dark spots, drooping stems."
                    />
                    <button type="submit" className="button-primary">
                      Run diagnosis
                    </button>
                  </form>
                ) : (
                  <p className="mt-4 text-sm text-[var(--color-muted)]">
                    Add at least one plant before running disease analysis.
                  </p>
                )}
              </div>
            </details>
            <div className="hidden rounded-lg border border-[var(--color-line)] bg-[var(--color-canvas-soft)] px-3 py-2 text-right xl:block">
              <p className="text-sm font-medium text-[var(--color-ink)]">{session.name}</p>
              <p className="text-xs text-[var(--color-muted)]">
                {session.location || "Location not set"}
              </p>
            </div>
            <form action={signOutAction}>
              <button type="submit" className="button-secondary min-h-10 rounded-lg px-4">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="space-y-4 pb-8">
        {children}
      </main>
    </div>
  );
}
