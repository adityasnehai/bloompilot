import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createDiagnosisAction } from "@/app/diagnosis-actions";
import { EmptyState } from "@/components/garden/empty-state";
import { CheckboxChip } from "@/components/forms/checkbox-chip";
import { SelectField } from "@/components/forms/select-field";
import { TextareaField } from "@/components/forms/textarea-field";
import {
  diagnosisSymptomOptions,
  readLatestDiagnosisRun,
  readRecentDiagnosisRuns,
} from "@/lib/diagnosis";
import { formatDateTime, readGardenState } from "@/lib/garden";
import { requireSession } from "@/lib/session";

export default async function DiagnosisPage() {
  const session = await requireSession();

  if (!session.onboarded) {
    redirect("/onboarding");
  }

  const [gardenState, latestRun, diagnosisRuns] = await Promise.all([
    readGardenState(),
    readLatestDiagnosisRun(),
    readRecentDiagnosisRuns(6),
  ]);

  if (gardenState.plants.length === 0) {
    return (
      <div className="surface-panel px-5 py-8 sm:px-6">
        <EmptyState
          title="Diagnosis needs at least one tracked plant."
          body="Add a plant first. BloomPilot saves every diagnosis to a tracked plant profile so the history stays clear."
          action={
            <Link href="/garden" className="button-primary">
              Add plants
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <section className="surface-panel px-5 py-6 sm:px-6">
        <p className="text-sm text-[var(--color-muted)]">Diagnosis</p>
        <h2 className="mt-2 text-2xl font-semibold text-[var(--color-ink)]">Plant health check</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
          Upload a plant photo, select visible symptoms, and save the result to the plant.
        </p>
      </section>

      <div className="grid gap-6 xl:grid-cols-[460px_minmax(0,1fr)]">
        <section className="surface-panel px-5 py-6 sm:px-6">
          <p className="text-sm text-[var(--color-muted)]">New diagnosis</p>
          <h3 className="mt-1 text-xl font-semibold text-[var(--color-ink)]">Upload a plant photo</h3>
          <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
            Use a clear close-up in good light, then select the strongest visible symptoms.
          </p>

          <form action={createDiagnosisAction} className="mt-6 grid gap-5">
            <SelectField
              label="Plant"
              name="plantId"
              defaultValue={gardenState.plants[0]?.id}
              options={gardenState.plants.map((plant) => ({
                label: `${plant.nickname} · ${plant.species}`,
                value: plant.id,
              }))}
            />

            <div className="grid gap-2">
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-[var(--color-ink)]">
                  Primary photo <span className="text-[var(--color-muted)] font-normal">(required)</span>
                </span>
                <input
                  type="file"
                  name="photo"
                  accept="image/*"
                  required
                  className="rounded-2xl border border-[rgba(16,52,39,0.12)] bg-white/85 px-4 py-3 text-sm text-[var(--color-ink)] shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] outline-none transition file:mr-4 file:rounded-2xl file:border-0 file:bg-[var(--color-canopy)] file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-[var(--color-moss)] focus:border-[var(--color-moss)] focus:ring-4 focus:ring-[rgba(76,121,97,0.12)]"
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-[var(--color-ink)]">
                  Additional photos <span className="text-[var(--color-muted)] font-normal">(optional, up to 2 more)</span>
                </span>
                <input
                  type="file"
                  name="photo2"
                  accept="image/*"
                  className="rounded-2xl border border-[rgba(16,52,39,0.12)] bg-white/85 px-4 py-3 text-sm text-[var(--color-ink)] shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] outline-none transition file:mr-4 file:rounded-2xl file:border-0 file:bg-[var(--color-line)] file:px-4 file:py-2 file:text-sm file:font-medium file:text-[var(--color-ink)] hover:file:bg-[var(--color-canvas-soft)] focus:border-[var(--color-moss)] focus:ring-4 focus:ring-[rgba(76,121,97,0.12)]"
                />
                <input
                  type="file"
                  name="photo3"
                  accept="image/*"
                  className="rounded-2xl border border-[rgba(16,52,39,0.12)] bg-white/85 px-4 py-3 text-sm text-[var(--color-ink)] shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] outline-none transition file:mr-4 file:rounded-2xl file:border-0 file:bg-[var(--color-line)] file:px-4 file:py-2 file:text-sm file:font-medium file:text-[var(--color-ink)] hover:file:bg-[var(--color-canvas-soft)] focus:border-[var(--color-moss)] focus:ring-4 focus:ring-[rgba(76,121,97,0.12)]"
                />
              </label>
              <span className="text-xs text-[var(--color-muted)]">
                Multiple angles improve diagnosis accuracy. Up to 4 MB each.
              </span>
            </div>

            <div className="grid gap-3">
              <p className="text-sm font-medium text-[var(--color-ink)]">Symptoms</p>
              <div className="grid gap-3 md:grid-cols-2">
                {diagnosisSymptomOptions.map((option) => (
                  <CheckboxChip
                    key={option.value}
                    name="symptoms"
                    value={option.value}
                    label={option.label}
                    description={option.description}
                  />
                ))}
              </div>
            </div>

            <TextareaField
              label="Observations"
              name="observation"
              placeholder="Older leaves are yellowing, and the newest leaf has brown spotting near the edge."
              hint="Optional, but it helps BloomPilot return a stronger diagnosis."
            />

            <button
              type="submit"
              className="button-primary"
            >
              Run diagnosis
            </button>
          </form>
        </section>

        <section className="grid gap-4">
          {latestRun ? (
            <article className="surface-panel px-5 py-6 sm:px-6">
              <p className="text-sm text-[var(--color-muted)]">Latest result</p>
              <h3 className="mt-1 text-xl font-semibold text-[var(--color-ink)]">
                {latestRun.issue}
              </h3>
              <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
                {latestRun.summary}
              </p>
              <p className="mt-3 text-sm text-[var(--color-muted)]">
                {latestRun.plantNickname} · {latestRun.confidence}% confidence · {latestRun.severity}
              </p>
              <p className="mt-2 text-xs text-[var(--color-muted)]">
                {formatDateTime(latestRun.createdAt)}
              </p>
            </article>
          ) : null}
          {diagnosisRuns.length > 0 ? (
            diagnosisRuns.map((run) => (
              <article
                key={run.id}
                className="surface-panel overflow-hidden px-5 py-5 sm:px-6"
              >
                <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
                  <div className="overflow-hidden rounded-[26px] border border-[rgba(16,52,39,0.08)] bg-[rgba(245,237,222,0.72)]">
                    <Image
                      src={run.photoUrl}
                      alt={`${run.plantNickname} diagnosis photo`}
                      width={440}
                      height={320}
                      unoptimized
                      className="h-full w-full object-cover"
                    />
                  </div>

                  <div>
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-sm text-[var(--color-muted)]">
                          {run.plantNickname} · {run.plantSpecies}
                        </p>
                        <h3 className="mt-1 text-xl font-semibold text-[var(--color-ink)]">
                          {run.issue}
                        </h3>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium uppercase tracking-[0.14em] ${
                          run.severity === "high"
                            ? "bg-[rgba(200,116,82,0.14)] text-[var(--color-copper)]"
                            : run.severity === "medium"
                              ? "bg-[rgba(197,162,90,0.16)] text-[var(--color-gold)]"
                              : "bg-[rgba(76,121,97,0.12)] text-[var(--color-moss)]"
                        }`}
                      >
                        {run.severity}
                      </span>
                    </div>

                    <p className="mt-3 text-sm leading-7 text-[var(--color-muted)]">
                      {run.summary}
                    </p>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="rounded-full border border-[rgba(16,52,39,0.08)] bg-white px-3 py-1 text-xs text-[var(--color-muted)]">
                        Confidence {run.confidence}%
                      </span>
                      <span className="rounded-full border border-[rgba(16,52,39,0.08)] bg-white px-3 py-1 text-xs text-[var(--color-muted)]">
                        {run.category}
                      </span>
                      {run.symptoms.map((symptom) => (
                        <span
                          key={symptom}
                          className="rounded-full border border-[rgba(16,52,39,0.08)] bg-[rgba(245,237,222,0.82)] px-3 py-1 text-xs text-[var(--color-muted)]"
                        >
                          {symptom.replaceAll("_", " ")}
                        </span>
                      ))}
                    </div>

                    <div className="mt-5 grid gap-3 md:grid-cols-2">
                      {run.treatment.map((step) => (
                        <div
                          key={step}
                          className="surface-card px-4 py-4 text-sm leading-6 text-[var(--color-ink)]"
                        >
                          {step}
                        </div>
                      ))}
                    </div>

                    <div className="surface-card-muted mt-5 p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-muted)]">
                        Follow-up
                      </p>
                      <p className="mt-2 text-sm leading-6 text-[var(--color-ink)]">
                        {run.followUp}
                      </p>
                      <p className="mt-3 text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">
                        {formatDateTime(run.createdAt)}
                      </p>
                    </div>
                  </div>
                </div>
              </article>
            ))
          ) : (
            <EmptyState
              title="No diagnosis history yet."
              body="Run the first plant health check to create a stored diagnosis timeline."
            />
          )}
        </section>
      </div>
    </div>
  );
}
