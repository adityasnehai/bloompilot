import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createDiagnosisAction } from "@/app/diagnosis-actions";
import { DiagnosisSubmitButton } from "@/components/diagnosis/diagnosis-submit-button";
import { EmptyState } from "@/components/garden/empty-state";
import { SelectField } from "@/components/forms/select-field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  getDiagnosisDisplayState,
  readLatestDiagnosisRun,
  readRecentDiagnosisRuns,
} from "@/lib/diagnosis";
import { formatDateTime, readGardenState } from "@/lib/garden";
import { requireSession } from "@/lib/session";

type DiagnosisState = ReturnType<typeof getDiagnosisDisplayState>;

function getStatusBadge(state: DiagnosisState) {
  if (state === "healthy") {
    return { label: "Healthy", className: "border-[var(--color-line)] bg-[rgba(117,176,120,0.12)] text-[var(--color-ink)]" };
  }
  if (state === "confirmed_issue") {
    return { label: "Needs attention", className: "border-[var(--color-line)] bg-[rgba(182,61,61,0.10)] text-[var(--color-ink)]" };
  }
  if (state === "provider_unavailable") {
    return { label: "Try again", className: "border-[var(--color-line)] bg-white/5 text-[var(--color-muted)]" };
  }
  if (state === "likely_issue") {
    return { label: "Needs review", className: "border-[var(--color-line)] bg-[rgba(213,158,59,0.12)] text-[var(--color-ink)]" };
  }
  return { label: "Unclear", className: "border-[var(--color-line)] bg-white/5 text-[var(--color-muted)]" };
}

function getResultHeading(state: DiagnosisState, issue: string) {
  if (state === "healthy") return "No disease signal found";
  if (state === "confirmed_issue") return issue;
  if (state === "likely_issue") return issue !== "Needs more evidence" ? `Possible: ${issue}` : "Needs review";
  if (state === "provider_unavailable") return "Scan could not be completed";
  return "Needs a clearer photo";
}

function getDiagnosisErrorMessage(value: string | undefined) {
  if (value === "missing_input") return "Choose a plant and photo first.";
  if (value === "invalid_file") return "Use a JPG, PNG, or WEBP image.";
  if (value === "file_too_large") return "Choose an image smaller than 4 MB.";
  if (value === "service_unavailable") return "The scan service is unavailable. Nothing was changed.";
  if (value === "unable_to_create") return "The scan could not be saved. Check the image and try again.";
  return null;
}

function ResultDetails({
  state,
  issue,
  summary,
  followUp,
  treatment,
  findings,
}: {
  state: DiagnosisState;
  issue: string;
  summary: string;
  followUp: string;
  treatment: string[];
  findings: { name: string; confidence: number; category: string }[];
}) {
  const badge = getStatusBadge(state);

  return (
    <>
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="mt-1 break-words text-xl font-semibold tracking-[-0.03em] text-[var(--color-ink)]">{getResultHeading(state, issue)}</h2>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${badge.className}`}>{badge.label}</span>
      </div>
      <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">{summary}</p>
      {findings.length > 0 ? (
        <div className="mt-3 grid gap-1.5">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--color-muted)]">Signals</p>
          {findings.map((finding) => (
            <div key={`${finding.name}-${finding.category}`} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-line)] bg-white/5 px-3 py-2 text-sm">
              <span className="text-[var(--color-ink)]">{finding.name}</span>
              <span className="shrink-0 text-xs text-[var(--color-muted)]">{finding.confidence}%</span>
            </div>
          ))}
        </div>
      ) : null}
      {state === "confirmed_issue" && treatment.length > 0 ? (
        <div className="mt-4 grid gap-2">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--color-muted)]">Next steps</p>
          {treatment.slice(0, 2).map((step) => (
            <div key={step} className="rounded-lg border border-[var(--color-line)] bg-[var(--color-canvas-soft)] px-3 py-2 text-sm leading-5 text-[var(--color-ink)]">{step}</div>
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-lg border border-[var(--color-line)] bg-[var(--color-canvas-soft)] px-3 py-2 text-sm leading-5 text-[var(--color-muted)]">{followUp}</div>
      )}
    </>
  );
}

export default async function DiagnosisPage({
  searchParams,
}: {
  searchParams?: Promise<{ diagnosis?: string; diagnosisError?: string }>;
}) {
  const session = await requireSession();
  if (!session.onboarded) redirect("/onboarding");

  const [gardenState, latestRun, diagnosisRuns] = await Promise.all([
    readGardenState(),
    readLatestDiagnosisRun(),
    readRecentDiagnosisRuns(6),
  ]);
  const resolvedSearchParams = await searchParams;
  const diagnosisError = getDiagnosisErrorMessage(resolvedSearchParams?.diagnosisError);
  if (gardenState.plants.length === 0) {
    return (
      <Card className="px-5 py-8 sm:px-6">
        <EmptyState
          title="Add a plant before running a scan."
          body="Each result is saved to a tracked plant so its history and care stay connected."
          action={<Button asChild><Link href="/garden">Add plant</Link></Button>}
        />
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      <header className="border-b border-[var(--color-line)] pb-4">
        <p className="eyebrow">Plant health</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-[var(--color-ink)] lg:text-[2rem]">Diagnosis</h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--color-muted)]">Upload a clear photo to review a plant, compare the strongest signal, and keep the result tied to the plant history.</p>
      </header>

      {diagnosisError ? <p role="alert" className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-[var(--color-muted)]">{diagnosisError}</p> : null}
      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(250px,0.34fr)_minmax(0,0.66fr)] lg:items-start">
        <Card as="section" className="min-w-0 overflow-hidden px-4 py-4 sm:px-5 lg:sticky lg:top-6">
          <div className="border-b border-[var(--color-line)] pb-4">
            <p className="eyebrow">New check</p>
            <h2 className="mt-1 text-[1.05rem] font-semibold tracking-[-0.03em] text-[var(--color-ink)]">Upload a plant photo</h2>
            <p className="mt-1 text-xs leading-5 text-[var(--color-muted)]">Pick the plant, add a clear image, and review the strongest signal.</p>
          </div>

          <form action={createDiagnosisAction} className="mt-4 grid min-w-0 grid-cols-1 gap-4">
            <input type="hidden" name="returnTo" value="/diagnosis" />
            <SelectField
              label="Plant to check"
              name="plantId"
              defaultValue={gardenState.plants[0]?.id}
              options={gardenState.plants.map((plant) => ({ label: `${plant.nickname} · ${plant.species}`, value: plant.id }))}
            />
            <div className="grid min-w-0 grid-cols-1 gap-2">
              <label className="flex min-w-0 flex-col gap-2">
                <span className="text-sm font-medium text-[var(--color-ink)]">Photo <span className="font-normal text-[var(--color-muted)]">required</span></span>
                <input
                  type="file"
                  name="photo"
                  accept="image/*"
                  required
                  className="w-full min-w-0 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-[var(--color-ink)] outline-none transition file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-black hover:file:bg-white/90 focus:border-white/20 focus:ring-4 focus:ring-white/10"
                />
              </label>
              <span className="block w-full break-words text-xs leading-5 text-[var(--color-muted)]">JPG, PNG, or WEBP · max 4 MB. Use a close-up with good light and one clear symptom.</span>
            </div>
            <DiagnosisSubmitButton />
          </form>
        </Card>

        <section className="grid min-w-0 gap-4">
          {latestRun ? (
            <Card as="article" className="overflow-hidden px-4 py-4 sm:px-5">
              <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--color-muted)]">
                <span className="font-medium text-[var(--color-ink)]">{latestRun.plantNickname}</span>
                <span>{formatDateTime(latestRun.createdAt)}</span>
              </div>
              <ResultDetails state={getDiagnosisDisplayState(latestRun)} issue={latestRun.issue} summary={latestRun.summary} followUp={latestRun.followUp} treatment={latestRun.treatment} findings={latestRun.findings} />
            </Card>
          ) : null}

          {diagnosisRuns.length > 0 ? (
            <section>
              <div className="mb-2 flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold tracking-[-0.02em] text-[var(--color-ink)]">Recent checks</h2>
              </div>
              <div className="grid gap-2">
                {diagnosisRuns.map((run) => {
                  const state = getDiagnosisDisplayState(run);
                  const badge = getStatusBadge(state);
                  return (
                    <article key={run.id} className="grid min-w-0 grid-cols-[68px_minmax(0,1fr)] gap-3 rounded-xl border border-[var(--color-line)] bg-[var(--color-canvas-soft)] p-3 sm:grid-cols-[80px_minmax(0,1fr)]">
                      <div className="h-16 overflow-hidden rounded-lg border border-[var(--color-line)] bg-white/5 sm:h-[72px]">
                        <Image src={run.photoUrl} alt={`${run.plantNickname} scan`} width={168} height={144} unoptimized className="h-full w-full object-cover" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-xs text-[var(--color-muted)]">{run.plantNickname}</p>
                            <h3 className="truncate text-sm font-semibold text-[var(--color-ink)]">{getResultHeading(state, run.issue)}</h3>
                          </div>
                          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${badge.className}`}>{badge.label}</span>
                        </div>
                        <p className="mt-1 text-[11px] text-[var(--color-muted)]">{formatDateTime(run.createdAt)}</p>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ) : (
            <EmptyState title="No scans yet" body="Your saved checks will appear here." />
          )}
        </section>
      </div>
    </div>
  );
}
