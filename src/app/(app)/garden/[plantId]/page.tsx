import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getDatabase } from "@/lib/database";
import { getCurrentWorkspaceUserId, formatDateTime } from "@/lib/garden";
import { requireSession } from "@/lib/session";
import { getKnowledgeFromDB } from "@/lib/plant-knowledge-db";
import { getPlantHealthHistory } from "@/lib/plant-memory";
import { getPlantNotes } from "@/lib/plant-notes";
import { PlantDetailClient } from "./plant-detail-client";

type PlantDetailRow = {
  id: string;
  nickname: string;
  species: string;
  placement: string;
  sunlight: string;
  watering_interval_days: number;
  notes: string;
  added_at: string;
  last_watered_at: string | null;
  photo_blob: Uint8Array | null;
  photo_type: string | null;
};

type DiagnosisRow = {
  id: string;
  plant_id: string;
  plant_nickname: string;
  issue: string;
  category: string;
  severity: string;
  confidence: number;
  summary: string;
  treatment_json: string;
  follow_up: string;
  created_at: string;
};

type MilestoneRow = {
  id: string;
  stage: string;
  note: string | null;
  recorded_at: string;
};

export default async function PlantDetailPage({
  params,
}: {
  params: Promise<{ plantId: string }>;
}) {
  const session = await requireSession();
  if (!session.onboarded) redirect("/onboarding");

  const { plantId } = await params;
  const userId = await getCurrentWorkspaceUserId();
  if (!userId) redirect("/onboarding");

  const db = getDatabase();

  const plant = db
    .prepare(
      `SELECT id, nickname, species, placement, sunlight, watering_interval_days, notes, added_at, last_watered_at, photo_blob, photo_type
       FROM plants WHERE id = ? AND user_id = ?`,
    )
    .get(plantId, userId) as PlantDetailRow | undefined;

  if (!plant) notFound();

  const diagnosisRows = db
    .prepare(
      `SELECT id, plant_id, plant_nickname, issue, category, severity, confidence, summary, treatment_json, follow_up, created_at
       FROM diagnosis_runs WHERE user_id = ? AND plant_id = ? ORDER BY datetime(created_at) DESC LIMIT 6`,
    )
    .all(userId, plantId) as DiagnosisRow[];

  const milestones = db
    .prepare(
      `SELECT id, stage, note, recorded_at FROM plant_milestones WHERE user_id = ? AND plant_id = ? ORDER BY datetime(recorded_at) DESC LIMIT 20`,
    )
    .all(userId, plantId) as MilestoneRow[];

  const [healthEvents, notes] = await Promise.all([
    getPlantHealthHistory(userId, plantId, 20),
    Promise.resolve(getPlantNotes(userId, plantId, 20)),
  ]);

  const knowledge = plant.species ? getKnowledgeFromDB(plant.species.toLowerCase().trim()) : null;

  const hasPhoto = !!plant.photo_blob;

  const diagnoses = diagnosisRows.map((row) => ({
    id: row.id,
    issue: row.issue,
    category: row.category,
    severity: row.severity,
    confidence: row.confidence,
    summary: row.summary,
    treatment: safeParseStringArray(row.treatment_json),
    followUp: row.follow_up,
    createdAt: row.created_at,
    photoUrl: `/api/diagnosis/photo/${row.id}`,
  }));

  return (
    <div className="grid gap-6">
      {/* Header */}
      <section className="surface-panel px-5 py-6 sm:px-6">
        <div className="flex flex-wrap items-start gap-4">
          {hasPhoto ? (
            <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-2xl border border-[var(--color-line)] bg-white/5">
              <Image
                src={`/api/plants/photo?plantId=${plantId}`}
                alt={plant.nickname}
                width={80}
                height={80}
                unoptimized
                className="h-full w-full object-cover"
              />
            </div>
          ) : (
            <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[var(--color-line)] bg-white/5">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-8 w-8 text-[var(--color-muted)]">
                <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z" />
                <path d="M12 22V12" />
              </svg>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <Link href="/garden" className="text-xs text-[var(--color-muted)] hover:text-[var(--color-ink)]">
              ← Garden
            </Link>
            <h2 className="mt-1 text-2xl font-semibold text-[var(--color-ink)]">{plant.nickname}</h2>
            <p className="text-sm text-[var(--color-muted)]">{plant.species}</p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-[var(--color-muted)]">
              <span className="rounded-full border border-[var(--color-line)] bg-white/5 px-2.5 py-0.5">{plant.placement}</span>
              <span className="rounded-full border border-[var(--color-line)] bg-white/5 px-2.5 py-0.5">{plant.sunlight}</span>
              <span className="rounded-full border border-[var(--color-line)] bg-white/5 px-2.5 py-0.5">Water every {plant.watering_interval_days}d</span>
              {plant.last_watered_at && (
                <span className="rounded-full border border-[var(--color-line)] bg-white/5 px-2.5 py-0.5">Last watered {formatDateTime(plant.last_watered_at)}</span>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="grid gap-6">
          {/* Knowledge panel */}
          {knowledge && (
            <section className="surface-panel px-5 py-6 sm:px-6">
              <p className="eyebrow">Care knowledge</p>
              <h3 className="mt-1 text-lg font-semibold text-[var(--color-ink)]">Species profile</h3>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {knowledge.wateringBaseline && (
                  <KnowledgeItem label="Watering" value={`${knowledge.wateringBaseline}${knowledge.wateringDaysMin ? ` (${knowledge.wateringDaysMin}–${knowledge.wateringDaysMax ?? "?"} days)` : ""}`} />
                )}
                {knowledge.sunlightPreference && (
                  <KnowledgeItem label="Sunlight" value={knowledge.sunlightPreference} />
                )}
                {knowledge.soilPreference && (
                  <KnowledgeItem label="Soil" value={knowledge.soilPreference} />
                )}
                {knowledge.temperatureMinC !== null && knowledge.temperatureMaxC !== null && (
                  <KnowledgeItem label="Temperature" value={`${knowledge.temperatureMinC}–${knowledge.temperatureMaxC} °C`} />
                )}
                {knowledge.humidityMinPercent !== null && knowledge.humidityMaxPercent !== null && (
                  <KnowledgeItem label="Humidity" value={`${knowledge.humidityMinPercent}–${knowledge.humidityMaxPercent}%`} />
                )}
                {knowledge.phMin !== null && knowledge.phMax !== null && (
                  <KnowledgeItem label="Soil pH" value={`${knowledge.phMin}–${knowledge.phMax}`} />
                )}
                {knowledge.nutrientRequirements && (
                  <KnowledgeItem label="Nutrients" value={knowledge.nutrientRequirements} />
                )}
                {knowledge.pruningMonths && (
                  <KnowledgeItem label="Pruning" value={knowledge.pruningMonths} />
                )}
              </div>
              {(knowledge.pestList.length > 0 || knowledge.diseaseList.length > 0 || knowledge.companionPlants.length > 0 || knowledge.toxicity) && (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {knowledge.toxicity && (
                    <div className="surface-card-muted p-3">
                      <p className="eyebrow">Toxicity</p>
                      <p className="mt-1 text-sm text-[var(--color-ink)]">{knowledge.toxicity}</p>
                    </div>
                  )}
                  {knowledge.pestList.length > 0 && (
                    <div className="surface-card-muted p-3">
                      <p className="eyebrow">Common pests</p>
                      <p className="mt-1 text-sm text-[var(--color-ink)]">{knowledge.pestList.slice(0, 4).join(", ")}</p>
                    </div>
                  )}
                  {knowledge.diseaseList.length > 0 && (
                    <div className="surface-card-muted p-3">
                      <p className="eyebrow">Disease watch</p>
                      <p className="mt-1 text-sm text-[var(--color-ink)]">{knowledge.diseaseList.slice(0, 4).join(", ")}</p>
                    </div>
                  )}
                  {knowledge.companionPlants.length > 0 && (
                    <div className="surface-card-muted p-3">
                      <p className="eyebrow">Companion plants</p>
                      <p className="mt-1 text-sm text-[var(--color-ink)]">{knowledge.companionPlants.slice(0, 4).join(", ")}</p>
                    </div>
                  )}
                </div>
              )}
              <p className="mt-3 text-xs text-[var(--color-muted)]">
                Confidence: {knowledge.confidence} · Sources: {knowledge.sources.join(", ")}
              </p>
            </section>
          )}

          {/* Diagnosis history */}
          <section className="surface-panel px-5 py-6 sm:px-6">
            <p className="eyebrow">Health history</p>
            <h3 className="mt-1 text-lg font-semibold text-[var(--color-ink)]">Diagnoses</h3>
            {diagnoses.length === 0 ? (
              <p className="mt-4 text-sm text-[var(--color-muted)]">No diagnoses yet. Run a health check from the <Link href="/diagnosis" className="underline">Diagnosis</Link> page.</p>
            ) : (
              <div className="mt-4 grid gap-4">
                {diagnoses.map((d) => (
                  <article key={d.id} className="surface-card overflow-hidden px-4 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h4 className="font-semibold text-[var(--color-ink)]">{d.issue}</h4>
                        <p className="text-xs text-[var(--color-muted)]">{d.category} · {formatDateTime(d.createdAt)}</p>
                      </div>
                      <SeverityBadge severity={d.severity} />
                    </div>
                    <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">{d.summary}</p>
                    {d.treatment.length > 0 && (
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {d.treatment.map((step) => (
                          <div key={step} className="surface-card-muted px-3 py-2 text-xs leading-5 text-[var(--color-ink)]">{step}</div>
                        ))}
                      </div>
                    )}
                    <div className="mt-3 flex items-center gap-2">
                      <span className="rounded-full border border-[var(--color-line)] bg-white/5 px-2.5 py-0.5 text-xs text-[var(--color-muted)]">
                        Confidence {d.confidence}%
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          {/* Health event timeline */}
          <section className="surface-panel px-5 py-6 sm:px-6">
            <p className="eyebrow">Activity</p>
            <h3 className="mt-1 text-lg font-semibold text-[var(--color-ink)]">Care timeline</h3>
            {healthEvents.length === 0 ? (
              <p className="mt-4 text-sm text-[var(--color-muted)]">No recorded events yet.</p>
            ) : (
              <ol className="mt-4 space-y-3">
                {healthEvents.map((ev) => (
                  <li key={ev.id} className="flex gap-3">
                    <EventDot eventType={ev.eventType} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[var(--color-ink)]">{ev.detail}</p>
                      <p className="text-xs text-[var(--color-muted)]">{formatDateTime(ev.createdAt)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        {/* Sidebar */}
        <div className="grid gap-6 content-start">
          <PlantDetailClient
            plantId={plantId}
            plantName={plant.nickname}
            initialNotes={notes}
            initialMilestones={milestones.map((m) => ({ id: m.id, stage: m.stage, note: m.note, recordedAt: m.recorded_at }))}
          />
        </div>
      </div>
    </div>
  );
}

function safeParseStringArray(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function KnowledgeItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">{label}</p>
      <p className="text-sm text-[var(--color-ink)]">{value}</p>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium uppercase tracking-[0.12em] ${
      severity === "high"
        ? "bg-[rgba(200,116,82,0.14)] text-[var(--color-copper)]"
        : severity === "medium"
          ? "bg-[rgba(197,162,90,0.16)] text-[var(--color-gold)]"
          : "bg-[rgba(76,121,97,0.12)] text-[var(--color-moss)]"
    }`}>
      {severity}
    </span>
  );
}

function EventDot({ eventType }: { eventType: string }) {
  const colorMap: Record<string, string> = {
    watered: "bg-[var(--color-moss)]",
    water_skipped: "bg-[var(--color-muted)]",
    diagnosed: "bg-[var(--color-copper)]",
    fertilized: "bg-[var(--color-gold)]",
    inspected: "bg-[var(--color-sage)]",
  };
  const color = colorMap[eventType] ?? "bg-[var(--color-muted)]";
  return (
    <div className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${color}`} />
  );
}
