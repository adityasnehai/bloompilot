import { getDatabase, withTransaction } from "@/lib/database";
import { readGardenState } from "@/lib/garden";
import {
  analyzePlantDisease,
  type DiagnosisEvidenceStatus,
  type DiagnosisFinding,
  type DiagnosisProvider,
} from "@/lib/disease-diagnosis";
import { readSession } from "@/lib/session";
import { upsertWorkspaceProfile } from "@/lib/workspace-store";
import { logHealthEvent, getPlantHealthHistory } from "@/lib/plant-memory";
import { appendDiagnosisTreatmentActions } from "@/lib/care-plan-engine";
import { readWeatherSnapshot } from "@/lib/weather";

export type DiagnosisSymptom =
  | "yellowing_leaves"
  | "wilting"
  | "brown_spots"
  | "powdery_residue"
  | "holes_in_leaves"
  | "sticky_residue"
  | "webbing"
  | "dry_edges";

export type DiagnosisSeverity = "low" | "medium" | "high";
export type DiagnosisDisplayState =
  | "healthy"
  | "likely_issue"
  | "possible_issue"
  | "confirmed_issue"
  | "provider_unavailable";

export type DiagnosisRun = {
  id: string;
  plantId: string;
  plantNickname: string;
  plantSpecies: string;
  imageName: string;
  imageContentType: string;
  imageSize: number;
  symptoms: DiagnosisSymptom[];
  observation: string;
  issue: string;
  findings: DiagnosisFinding[];
  category: string;
  severity: DiagnosisSeverity;
  confidence: number;
  summary: string;
  treatment: string[];
  followUp: string;
  provider: DiagnosisProvider;
  evidenceStatus: DiagnosisEvidenceStatus;
  evidenceNotes: string[];
  createdAt: string;
  photoUrl: string;
};

type DiagnosisInput = {
  plantId: string;
  photo: File;
  additionalPhotos?: File[];
  symptoms?: DiagnosisSymptom[];
  observation: string;
};

type DiagnosisRow = {
  id: string;
  plant_id: string;
  plant_nickname: string;
  plant_species: string;
  image_name: string;
  image_content_type: string;
  image_size: number;
  symptoms_json: string;
  observation: string;
  issue: string;
  category: string;
  severity: DiagnosisSeverity;
  confidence: number;
  summary: string;
  treatment_json: string;
  follow_up: string;
  diagnosis_provider: string;
  diagnosis_evidence_status: string;
  diagnosis_evidence_notes_json: string;
  diagnosis_findings_json: string;
  created_at: string;
};

type DiagnosisPhotoRow = {
  image_blob: Uint8Array;
  image_content_type: string;
  image_name: string;
};

const MAX_PHOTO_BYTES = 4 * 1024 * 1024;

async function getCurrentWorkspaceUserId() {
  const session = await readSession();

  if (!session) {
    return null;
  }

  return upsertWorkspaceProfile(session);
}

function mapRowToDiagnosis(row: DiagnosisRow): DiagnosisRun {
  return {
    id: row.id,
    plantId: row.plant_id,
    plantNickname: row.plant_nickname,
    plantSpecies: row.plant_species,
    imageName: row.image_name,
    imageContentType: row.image_content_type,
    imageSize: row.image_size,
    symptoms: parseSymptoms(row.symptoms_json),
    observation: row.observation,
    issue: row.issue,
    findings: parseFindings(row.diagnosis_findings_json),
    category: row.category,
    severity: row.severity,
    confidence: row.confidence,
    summary: row.summary,
    treatment: parseTreatment(row.treatment_json),
    followUp: row.follow_up,
    provider: parseProvider(row.diagnosis_provider),
    evidenceStatus: parseEvidenceStatus(row.diagnosis_evidence_status),
    evidenceNotes: parseStringArray(row.diagnosis_evidence_notes_json),
    createdAt: row.created_at,
    photoUrl: `/api/diagnosis/photo/${row.id}`,
  };
}

function parseSymptoms(raw: string) {
  try {
    const parsed = JSON.parse(raw) as string[];
    return parsed.filter(isDiagnosisSymptom);
  } catch {
    return [] as DiagnosisSymptom[];
  }
}

function isDiagnosisSymptom(value: string): value is DiagnosisSymptom {
  return (
    value === "yellowing_leaves" ||
    value === "wilting" ||
    value === "brown_spots" ||
    value === "powdery_residue" ||
    value === "holes_in_leaves" ||
    value === "sticky_residue" ||
    value === "webbing" ||
    value === "dry_edges"
  );
}

function parseTreatment(raw: string) {
  try {
    const parsed = JSON.parse(raw) as string[];
    return parsed.filter(Boolean);
  } catch {
    return [] as string[];
  }
}

function parseStringArray(raw: string) {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((value) => String(value).trim()).filter(Boolean) : [];
  } catch {
    return [] as string[];
  }
}

function parseFindings(raw: string) {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((value): value is DiagnosisFinding => Boolean(
          value &&
            typeof value === "object" &&
            typeof value.name === "string" &&
            typeof value.confidence === "number" &&
            typeof value.category === "string",
        ))
      : [];
  } catch {
    return [] as DiagnosisFinding[];
  }
}

function parseProvider(value: string): DiagnosisProvider {
  return value === "kindwise_api" ? "kindwise_api" : "local_rule";
}

function parseEvidenceStatus(value: string): DiagnosisEvidenceStatus {
  return value === "confirmed" ? "confirmed" : "needs_more_evidence";
}

const NON_ACTIONABLE_DIAGNOSIS_ISSUES = new Set([
  "Provider unavailable",
  "Needs more evidence",
]);

export function isNonActionableDiagnosisIssue(issue: string | null | undefined) {
  return !issue || NON_ACTIONABLE_DIAGNOSIS_ISSUES.has(issue.trim());
}

export function isCareActionableDiagnosisRun(
  run: Pick<DiagnosisRun, "category" | "evidenceStatus" | "issue">,
) {
  return (
    run.evidenceStatus === "confirmed" &&
    run.category !== "healthy" &&
    !isNonActionableDiagnosisIssue(run.issue)
  );
}

export function getDiagnosisDisplayState(
  run: Pick<DiagnosisRun, "category" | "evidenceStatus" | "provider" | "issue" | "confidence">,
): DiagnosisDisplayState {
  if (run.issue === "Provider unavailable") {
    return "provider_unavailable";
  }
  if (run.category === "healthy" && run.evidenceStatus === "confirmed") {
    return "healthy";
  }
  if (isCareActionableDiagnosisRun(run)) {
    return "confirmed_issue";
  }
  if (
    run.evidenceStatus === "needs_more_evidence" &&
    run.confidence > 0 &&
    !isNonActionableDiagnosisIssue(run.issue)
  ) {
    return "likely_issue";
  }
  return "possible_issue";
}

export async function createDiagnosisRun(input: DiagnosisInput) {
  const userId = await getCurrentWorkspaceUserId();

  if (!userId) {
    return null;
  }

  if (!input.photo || input.photo.size === 0) {
    return null;
  }

  if (!input.photo.type.startsWith("image/")) {
    return null;
  }

  if (input.photo.size > MAX_PHOTO_BYTES) {
    return null;
  }

  const garden = await readGardenState();
  const plant = garden.plants.find((entry) => entry.id === input.plantId);

  if (!plant) {
    return null;
  }

  const imageBytes = new Uint8Array(await input.photo.arrayBuffer());

  // Fetch weather and care history in parallel for richer diagnosis context
  const db = await getDatabase();
  const userRow = await db.prepare(`SELECT latitude, longitude FROM users WHERE id = ?`).get(userId) as
    | { latitude: number | null; longitude: number | null }
    | undefined;

  const [weatherResult, careHistory] = await Promise.allSettled([
    userRow?.latitude && userRow?.longitude
      ? readWeatherSnapshot(userRow.latitude, userRow.longitude)
      : Promise.resolve(null),
    Promise.resolve(getPlantHealthHistory(userId, plant.id, 5)),
  ]);

  const weather = weatherResult.status === "fulfilled" ? weatherResult.value : null;
  const history = careHistory.status === "fulfilled" ? careHistory.value : [];

  const analysis = await analyzePlantDisease({
    plantName: plant.nickname,
    species: plant.species,
    observation: input.observation.trim(),
    image: {
      bytes: imageBytes,
      mimeType: input.photo.type,
    },
    weather: weather
      ? {
          temperatureC: weather.temperatureC,
          humidity: weather.humidity,
          windSpeedKph: weather.windSpeedKph,
          uvIndex: weather.uvIndex,
          rainLikely: weather.rainLikely,
          heatRisk: weather.heatRisk,
          frostRisk: weather.frostRisk,
        }
      : null,
    careHistory: history,
  });
  const createdAt = new Date().toISOString();
  const runId = crypto.randomUUID();

  await withTransaction(async (database) => {
      await database
      .prepare(
        `
          INSERT INTO diagnosis_runs (
            id, user_id, plant_id, plant_nickname, plant_species,
            image_name, image_content_type, image_size, image_blob,
            symptoms_json, observation, issue, category, severity,
            confidence, summary, treatment_json, follow_up,
            diagnosis_provider, diagnosis_evidence_status, diagnosis_evidence_notes_json, diagnosis_findings_json,
            created_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        runId,
        userId,
        plant.id,
        plant.nickname,
        plant.species,
        input.photo.name || "upload.jpg",
        input.photo.type,
        input.photo.size,
        imageBytes,
        JSON.stringify([]),
        input.observation.trim(),
        analysis.issue,
        analysis.category,
        analysis.severity,
        analysis.confidence,
        analysis.summary,
        JSON.stringify(analysis.treatment),
        analysis.followUp,
        analysis.provider,
        analysis.evidenceStatus,
        JSON.stringify(analysis.evidenceNotes),
        JSON.stringify(analysis.findings),
        createdAt,
      );

    await database
      .prepare(
        `
          INSERT INTO activities (
            id, user_id, type, title, detail, created_at, plant_id
          )
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        crypto.randomUUID(),
        userId,
        "diagnosis_logged",
        `Diagnosed ${plant.nickname}`,
        `${analysis.issue} recorded at ${analysis.confidence}% confidence.`,
        createdAt,
        plant.id,
      );
  });

  const actionableDiagnosis = isCareActionableDiagnosisRun(analysis);

  await logHealthEvent(
    userId,
    plant.id,
    plant.nickname,
    actionableDiagnosis ? "diagnosed" : "care_note",
    `${analysis.issue} — ${analysis.evidenceStatus} at ${analysis.confidence}% confidence`,
    {
      runId,
      issue: analysis.issue,
      category: analysis.category,
      severity: analysis.severity,
      confidence: analysis.confidence,
      evidenceStatus: analysis.evidenceStatus,
      provider: analysis.provider,
    },
  );

  if (actionableDiagnosis) {
    await appendDiagnosisTreatmentActions(userId, {
      plantId: plant.id,
      plantNickname: plant.nickname,
      issue: analysis.issue,
      category: analysis.category,
      severity: analysis.severity,
    });
  }

  return {
    id: runId,
    plantId: plant.id,
    plantNickname: plant.nickname,
    plantSpecies: plant.species,
    imageName: input.photo.name || "upload.jpg",
    imageContentType: input.photo.type,
    imageSize: input.photo.size,
    symptoms: [],
    observation: input.observation.trim(),
    issue: analysis.issue,
    findings: analysis.findings,
    category: analysis.category,
    severity: analysis.severity,
    confidence: analysis.confidence,
    summary: analysis.summary,
    treatment: analysis.treatment,
    followUp: analysis.followUp,
    provider: analysis.provider,
    evidenceStatus: analysis.evidenceStatus,
    evidenceNotes: analysis.evidenceNotes,
    createdAt,
    photoUrl: `/api/diagnosis/photo/${runId}`,
  } satisfies DiagnosisRun;
}

export async function readRecentDiagnosisRuns(limit = 8) {
  const userId = await getCurrentWorkspaceUserId();

  if (!userId) {
    return [] as DiagnosisRun[];
  }

  const database = await getDatabase();
  const rows = await database
    .prepare(
      `
        SELECT id, plant_id, plant_nickname, plant_species, image_name,
               image_content_type, image_size, symptoms_json, observation,
               issue, category, severity, confidence, summary, treatment_json,
               follow_up, diagnosis_provider, diagnosis_evidence_status,
               diagnosis_evidence_notes_json, diagnosis_findings_json, created_at
        FROM diagnosis_runs
        WHERE user_id = ?
        ORDER BY datetime(created_at) DESC
        LIMIT ?
      `,
    )
    .all(userId, limit) as DiagnosisRow[];

  return rows.map(mapRowToDiagnosis);
}

export async function readCareRelevantDiagnosisRuns(limit = 8) {
  const userId = await getCurrentWorkspaceUserId();

  if (!userId) {
    return [] as DiagnosisRun[];
  }

  const database = await getDatabase();
  const rows = await database
    .prepare(
      `
        SELECT id, plant_id, plant_nickname, plant_species, image_name,
               image_content_type, image_size, symptoms_json, observation,
               issue, category, severity, confidence, summary, treatment_json,
               follow_up, diagnosis_provider, diagnosis_evidence_status,
               diagnosis_evidence_notes_json, diagnosis_findings_json, created_at
        FROM diagnosis_runs
        WHERE user_id = ?
          AND diagnosis_evidence_status = 'confirmed'
          AND category != 'healthy'
          AND issue NOT IN ('Provider unavailable', 'Needs more evidence')
        ORDER BY datetime(created_at) DESC
        LIMIT ?
      `,
    )
    .all(userId, limit) as DiagnosisRow[];

  return rows.map(mapRowToDiagnosis);
}

export async function readLatestDiagnosisRun() {
  const [latest] = await readRecentDiagnosisRuns(1);
  return latest ?? null;
}

export async function readDiagnosisPhoto(runId: string) {
  const userId = await getCurrentWorkspaceUserId();

  if (!userId) {
    return null;
  }

  const database = await getDatabase();
  const row = await database
    .prepare(
      `
        SELECT image_blob, image_content_type, image_name
        FROM diagnosis_runs
        WHERE id = ? AND user_id = ?
      `,
    )
    .get(runId, userId) as DiagnosisPhotoRow | undefined;

  return row ?? null;
}
