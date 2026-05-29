import { getDatabase, withTransaction } from "@/lib/database";
import { readGardenState, type Plant } from "@/lib/garden";
import { requestOpenAIJson } from "@/lib/openai";
import { readSession } from "@/lib/session";
import { upsertWorkspaceProfile } from "@/lib/workspace-store";
import { logHealthEvent, getPlantHealthHistory } from "@/lib/plant-memory";
import { appendDiagnosisTreatmentActions } from "@/lib/care-plan-engine";
import { readWeatherSnapshot, type WeatherSnapshot } from "@/lib/weather";

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
  category: string;
  severity: DiagnosisSeverity;
  confidence: number;
  summary: string;
  treatment: string[];
  followUp: string;
  createdAt: string;
  photoUrl: string;
};

type DiagnosisInput = {
  plantId: string;
  photo: File;
  additionalPhotos?: File[];
  symptoms: DiagnosisSymptom[];
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
  created_at: string;
};

type DiagnosisPhotoRow = {
  image_blob: Uint8Array;
  image_content_type: string;
  image_name: string;
};

const MAX_PHOTO_BYTES = 4 * 1024 * 1024;

export const diagnosisSymptomOptions: {
  value: DiagnosisSymptom;
  label: string;
  description: string;
}[] = [
  {
    value: "yellowing_leaves",
    label: "Yellowing leaves",
    description: "Leaf color is fading or turning yellow.",
  },
  {
    value: "wilting",
    label: "Wilting",
    description: "Stems or leaves are drooping and losing tension.",
  },
  {
    value: "brown_spots",
    label: "Brown spots",
    description: "Circular or irregular dark lesions are visible.",
  },
  {
    value: "powdery_residue",
    label: "Powdery residue",
    description: "White dusty patches are coating the leaves.",
  },
  {
    value: "holes_in_leaves",
    label: "Holes in leaves",
    description: "Chewed edges or missing pieces are visible.",
  },
  {
    value: "sticky_residue",
    label: "Sticky residue",
    description: "Leaves feel tacky or shiny from pest activity.",
  },
  {
    value: "webbing",
    label: "Webbing",
    description: "Fine webs are collecting around stems or leaf joints.",
  },
  {
    value: "dry_edges",
    label: "Dry edges",
    description: "Tips or margins are crisping and browning.",
  },
];

function isDiagnosisSymptom(value: string): value is DiagnosisSymptom {
  return diagnosisSymptomOptions.some((option) => option.value === value);
}

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
    category: row.category,
    severity: row.severity,
    confidence: row.confidence,
    summary: row.summary,
    treatment: parseTreatment(row.treatment_json),
    followUp: row.follow_up,
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

function parseTreatment(raw: string) {
  try {
    const parsed = JSON.parse(raw) as string[];
    return parsed.filter(Boolean);
  } catch {
    return [] as string[];
  }
}

function inferSymptoms(observation: string) {
  const value = observation.toLowerCase();
  const inferred = new Set<DiagnosisSymptom>();

  if (value.includes("yellow")) {
    inferred.add("yellowing_leaves");
  }
  if (value.includes("wilt") || value.includes("droop")) {
    inferred.add("wilting");
  }
  if (value.includes("spot") || value.includes("patch")) {
    inferred.add("brown_spots");
  }
  if (value.includes("powder") || value.includes("dust")) {
    inferred.add("powdery_residue");
  }
  if (value.includes("hole") || value.includes("chew")) {
    inferred.add("holes_in_leaves");
  }
  if (value.includes("sticky") || value.includes("sap")) {
    inferred.add("sticky_residue");
  }
  if (value.includes("web")) {
    inferred.add("webbing");
  }
  if (value.includes("dry") || value.includes("crisp") || value.includes("brown edge")) {
    inferred.add("dry_edges");
  }

  return [...inferred];
}

function buildDiagnosis(plant: Plant, symptoms: DiagnosisSymptom[], observation: string) {
  const mergedSymptoms = Array.from(new Set([...symptoms, ...inferSymptoms(observation)]));
  const complete = <T extends Omit<DiagnosisRun, "id" | "plantId" | "plantNickname" | "plantSpecies" | "imageName" | "imageContentType" | "imageSize" | "symptoms" | "observation" | "createdAt" | "photoUrl">>(
    value: T,
  ) => ({
    ...value,
    symptoms: mergedSymptoms,
  });

  if (mergedSymptoms.includes("webbing")) {
    return complete({
      issue: "Spider mite pressure",
      category: "pest",
      severity: "high" as const,
      confidence: 91,
      summary: `${plant.nickname} is showing classic spider mite stress with visible webbing and likely leaf damage.`,
      treatment: [
        "Isolate the plant away from the rest of the collection today.",
        "Rinse leaf surfaces thoroughly, especially the undersides.",
        "Repeat a gentle insecticidal soap or neem treatment every 5 to 7 days.",
      ],
      followUp: "Recheck leaf joints in 48 hours and keep humidity slightly higher to slow the spread.",
    });
  }

  if (mergedSymptoms.includes("powdery_residue")) {
    return complete({
      issue: "Powdery mildew risk",
      category: "fungal",
      severity: "high" as const,
      confidence: 88,
      summary: `${plant.nickname} likely has powdery mildew or another fungal film developing on the foliage.`,
      treatment: [
        "Remove the most affected leaves if the plant can tolerate pruning.",
        "Improve airflow and avoid wetting foliage during watering.",
        "Use a targeted fungicidal treatment on the next care pass.",
      ],
      followUp: "Keep the plant bright and dry on leaf surfaces for the next week while monitoring spread.",
    });
  }

  if (mergedSymptoms.includes("sticky_residue")) {
    return complete({
      issue: "Sap-feeding pest activity",
      category: "pest",
      severity: "medium" as const,
      confidence: 84,
      summary: `${plant.nickname} may be dealing with aphids, scale, or another sap-feeding pest causing sticky residue.`,
      treatment: [
        "Inspect stems and leaf undersides for clustered insects.",
        "Wipe affected surfaces with a damp cloth before treatment.",
        "Apply insecticidal soap and repeat on the next weekly inspection.",
      ],
      followUp: "Watch for new sticky spots during the next two inspections.",
    });
  }

  if (mergedSymptoms.includes("holes_in_leaves")) {
    return complete({
      issue: "Chewing pest damage",
      category: "pest",
      severity: "medium" as const,
      confidence: 79,
      summary: `${plant.nickname} has visible feeding damage that suggests a chewing pest is active.`,
      treatment: [
        "Inspect leaves at dusk or early morning for active pests.",
        "Remove heavily damaged leaves if the plant has enough healthy foliage.",
        "Treat with a pest-specific spray if damage continues over the next cycle.",
      ],
      followUp: "Track whether new holes appear within the next 3 days before escalating treatment.",
    });
  }

  if (mergedSymptoms.includes("brown_spots")) {
    return complete({
      issue: "Leaf spot stress",
      category: "fungal",
      severity: "medium" as const,
      confidence: 76,
      summary: `${plant.nickname} is showing brown spotting that often maps to leaf spot, splash damage, or localized fungal stress.`,
      treatment: [
        "Keep foliage dry and improve spacing or airflow around the plant.",
        "Trim the worst damaged leaves if the issue is spreading.",
        "Reduce overhead watering and sanitize nearby tools.",
      ],
      followUp: "Compare the spotting pattern after the next watering cycle to confirm whether it is spreading.",
    });
  }

  if (
    mergedSymptoms.includes("yellowing_leaves") &&
    (mergedSymptoms.includes("wilting") || plant.wateringIntervalDays <= 3)
  ) {
    return complete({
      issue: "Overwatering stress",
      category: "watering",
      severity: "medium" as const,
      confidence: 81,
      summary: `${plant.nickname} looks more like a watering imbalance than a disease event, with yellowing that can point to overwatering.`,
      treatment: [
        "Pause watering until the top layer of soil dries more fully.",
        "Check drainage and avoid letting the pot sit in trapped water.",
        "Shift the plant into brighter airflow if conditions are stagnant.",
      ],
      followUp: "Reassess leaf firmness in 2 to 3 days before resuming the normal watering rhythm.",
    });
  }

  if (mergedSymptoms.includes("dry_edges") || mergedSymptoms.includes("wilting")) {
    return complete({
      issue: "Underwatering or heat stress",
      category: "watering",
      severity: mergedSymptoms.includes("dry_edges") ? "medium" : "low",
      confidence: mergedSymptoms.includes("dry_edges") ? 78 : 69,
      summary: `${plant.nickname} is showing dehydration stress, likely from dry soil, heat load, or missed watering cadence.`,
      treatment: [
        "Check soil moisture deeper than the surface before the next action.",
        "Water thoroughly once, then let the plant settle back into schedule.",
        "Reduce harsh direct exposure for a day if the plant is heat-stressed.",
      ],
      followUp: "Watch for improved leaf tension within 24 hours after a deep watering.",
    });
  }

  return complete({
    issue: "General plant stress",
    category: "observation",
    severity: "low" as const,
    confidence: 61,
    summary: `${plant.nickname} shows mild stress, but the current signal set is too weak for a stronger diagnosis.`,
    treatment: [
      "Keep the plant on its normal care cadence without stacking multiple interventions.",
      "Take a clearer follow-up photo in brighter light within the next few days.",
      "Use the inspection task to compare new growth against the affected area.",
    ],
    followUp: "Capture a second photo after the next care cycle if symptoms persist or intensify.",
  });
}

function normalizeSeverity(value: string): DiagnosisSeverity {
  if (value === "medium" || value === "high") {
    return value;
  }

  return "low";
}

async function buildDiagnosisWithAI(
  plant: Plant,
  symptoms: DiagnosisSymptom[],
  observation: string,
  imageBytes: Uint8Array,
  mimeType: string,
  extraImages?: { bytes: Uint8Array; mimeType: string }[],
  weather?: WeatherSnapshot | null,
  careHistory?: { eventType: string; detail: string; createdAt: string }[],
) {
  const weatherSection = weather
    ? `Current weather:
- temperature: ${weather.temperatureC !== null ? `${weather.temperatureC}°C` : "unknown"} (feels like ${weather.apparentTemperatureC !== null ? `${weather.apparentTemperatureC}°C` : "unknown"})
- humidity: ${weather.humidity !== null ? `${weather.humidity}%` : "unknown"}
- wind: ${weather.windSpeedKph !== null ? `${weather.windSpeedKph}kph` : "unknown"}
- UV index: ${weather.uvIndex !== null ? weather.uvIndex : "unknown"}
- soil temperature: ${weather.soilTemperatureC !== null ? `${weather.soilTemperatureC}°C` : "unknown"}
- soil moisture: ${weather.soilMoistureRatio !== null ? weather.soilMoistureRatio : "unknown"}
- heat risk: ${weather.heatRisk ? "yes" : "no"}, frost risk: ${weather.frostRisk ? "yes" : "no"}, rain likely: ${weather.rainLikely ? "yes" : "no"}, high wind: ${(weather.windSpeedKph ?? 0) >= 40 ? "yes" : "no"}`
    : "Weather: unavailable";

  const historySection =
    careHistory && careHistory.length > 0
      ? `Recent care events (newest first):\n${careHistory
          .slice(0, 5)
          .map((e) => `- [${e.createdAt.split("T")[0]}] ${e.eventType}: ${e.detail}`)
          .join("\n")}`
      : "Recent care events: none recorded";

  try {
    const response = await requestOpenAIJson<{
      issue: string;
      category: string;
      severity: DiagnosisSeverity;
      confidence: number;
      summary: string;
      treatment: string[];
      followUp: string;
    }>({
      prompt: `
You are diagnosing a home garden plant for a gardening SaaS product.

Plant:
- nickname: ${plant.nickname}
- species: ${plant.species}
- watering cadence: every ${plant.wateringIntervalDays} days

${weatherSection}

${historySection}

Visible symptoms:
${symptoms.length > 0 ? symptoms.map((symptom) => `- ${symptom.replaceAll("_", " ")}`).join("\n") : "- none provided"}

User notes:
${observation || "No extra notes."}

Use the weather and care history to sharpen your diagnosis (e.g. heat stress if temp is high, overwatering if recently watered, fungal if high humidity).

Return JSON only with this exact shape:
{
  "issue": string,
  "category": string,
  "severity": "low" | "medium" | "high",
  "confidence": integer,
  "summary": string,
  "treatment": string[],
  "followUp": string
}

Rules:
- confidence must be 50 to 98
- treatment must have 3 short action steps
- be conservative and practical
- focus on home gardening actions, not lab certainty
      `.trim(),
      image: {
        bytes: imageBytes,
        mimeType,
      },
      images: extraImages,
      maxOutputTokens: 500,
    });

    return {
      symptoms: Array.from(new Set(symptoms)),
      issue: response.issue?.trim() || "General plant stress",
      category: response.category?.trim() || "observation",
      severity: normalizeSeverity(response.severity),
      confidence: Math.max(
        50,
        Math.min(98, Math.round(Number(response.confidence) || 65)),
      ),
      summary: response.summary?.trim() || `${plant.nickname} shows visible stress that should be monitored closely.`,
      treatment:
        Array.isArray(response.treatment) && response.treatment.length > 0
          ? response.treatment.map((item) => item.trim()).filter(Boolean).slice(0, 3)
          : [
              "Inspect the plant closely before making multiple changes at once.",
              "Adjust watering carefully and avoid overcorrecting in one day.",
              "Take a follow-up photo after the next care cycle.",
            ],
      followUp:
        response.followUp?.trim() ||
        "Check the plant again after the next care cycle to confirm whether symptoms are improving.",
    };
  } catch {
    return buildDiagnosis(plant, symptoms, observation);
  }
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

  const extraImages: { bytes: Uint8Array; mimeType: string }[] = [];
  for (const extra of input.additionalPhotos ?? []) {
    if (extra.size > 0 && extra.type.startsWith("image/") && extra.size <= MAX_PHOTO_BYTES) {
      extraImages.push({ bytes: new Uint8Array(await extra.arrayBuffer()), mimeType: extra.type });
    }
  }

  // Fetch weather and care history in parallel for richer diagnosis context
  const db = getDatabase();
  const userRow = db.prepare(`SELECT latitude, longitude FROM users WHERE id = ?`).get(userId) as
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

  const analysis = await buildDiagnosisWithAI(
    plant,
    input.symptoms,
    input.observation.trim(),
    imageBytes,
    input.photo.type,
    extraImages.length > 0 ? extraImages : undefined,
    weather,
    history,
  );
  const createdAt = new Date().toISOString();
  const runId = crypto.randomUUID();

  withTransaction((database) => {
    database
      .prepare(
        `
          INSERT INTO diagnosis_runs (
            id, user_id, plant_id, plant_nickname, plant_species,
            image_name, image_content_type, image_size, image_blob,
            symptoms_json, observation, issue, category, severity,
            confidence, summary, treatment_json, follow_up, created_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        JSON.stringify(analysis.symptoms),
        input.observation.trim(),
        analysis.issue,
        analysis.category,
        analysis.severity,
        analysis.confidence,
        analysis.summary,
        JSON.stringify(analysis.treatment),
        analysis.followUp,
        createdAt,
      );

    database
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

  logHealthEvent(
    userId,
    plant.id,
    plant.nickname,
    "diagnosed",
    `${analysis.issue} — ${analysis.severity} severity at ${analysis.confidence}% confidence`,
    {
      runId,
      issue: analysis.issue,
      category: analysis.category,
      severity: analysis.severity,
      confidence: analysis.confidence,
    },
  );

  appendDiagnosisTreatmentActions(userId, {
    plantId: plant.id,
    plantNickname: plant.nickname,
    issue: analysis.issue,
    category: analysis.category,
    severity: analysis.severity,
  });

  return {
    id: runId,
    plantId: plant.id,
    plantNickname: plant.nickname,
    plantSpecies: plant.species,
    imageName: input.photo.name || "upload.jpg",
    imageContentType: input.photo.type,
    imageSize: input.photo.size,
    symptoms: analysis.symptoms,
    observation: input.observation.trim(),
    issue: analysis.issue,
    category: analysis.category,
    severity: analysis.severity,
    confidence: analysis.confidence,
    summary: analysis.summary,
    treatment: analysis.treatment,
    followUp: analysis.followUp,
    createdAt,
    photoUrl: `/api/diagnosis/photo/${runId}`,
  } satisfies DiagnosisRun;
}

export async function readRecentDiagnosisRuns(limit = 8) {
  const userId = await getCurrentWorkspaceUserId();

  if (!userId) {
    return [] as DiagnosisRun[];
  }

  const database = getDatabase();
  const rows = database
    .prepare(
      `
        SELECT id, plant_id, plant_nickname, plant_species, image_name,
               image_content_type, image_size, symptoms_json, observation,
               issue, category, severity, confidence, summary, treatment_json,
               follow_up, created_at
        FROM diagnosis_runs
        WHERE user_id = ?
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

  const database = getDatabase();
  const row = database
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

export function parseDiagnosisSymptoms(formData: FormData) {
  const values = formData
    .getAll("symptoms")
    .map((value) => value.toString())
    .filter(isDiagnosisSymptom);

  return Array.from(new Set(values));
}
