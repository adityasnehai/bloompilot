export type DiagnosisSeverity = "low" | "medium" | "high";
export type DiagnosisEvidenceStatus = "confirmed" | "needs_more_evidence";
export type DiagnosisProvider = "kindwise_api" | "local_rule";

export type DiagnosisFinding = {
  name: string;
  confidence: number;
  category: string;
};

export type DiseaseDiagnosisResult = {
  provider: DiagnosisProvider;
  evidenceStatus: DiagnosisEvidenceStatus;
  issue: string;
  findings: DiagnosisFinding[];
  category: string;
  severity: DiagnosisSeverity;
  confidence: number;
  summary: string;
  treatment: string[];
  followUp: string;
  evidenceNotes: string[];
};

type DiagnosisContext = {
  plantName: string;
  species: string;
  observation: string;
  image: {
    bytes: Uint8Array;
    mimeType: string;
  };
  weather?: {
    temperatureC: number | null;
    humidity: number | null;
    windSpeedKph: number | null;
    uvIndex: number | null;
    rainLikely: boolean;
    heatRisk: boolean;
    frostRisk: boolean;
  } | null;
  careHistory?: { eventType: string; detail: string; createdAt: string }[];
};

const KINDWISE_DEFAULT_URL = "https://api.plant.id/v2/health_assessment";

function requireKindwiseKey() {
  const key = process.env.KINDWISE_API_KEY?.trim();
  return key || null;
}

function getKindwiseUrl() {
  return process.env.KINDWISE_API_URL?.trim() || KINDWISE_DEFAULT_URL;
}

function toBase64(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("base64");
}

function trimList(values: string[]) {
  return values.map((value) => value.trim()).filter(Boolean).slice(0, 4);
}

function buildNeedsMoreEvidence(context: DiagnosisContext): DiseaseDiagnosisResult {
  const evidenceNotes = [
    `Plant: ${context.plantName} (${context.species})`,
    context.observation ? `User note: ${context.observation}` : "User note: none",
    context.weather
      ? `Weather context: temp=${context.weather.temperatureC ?? "unknown"}°C, humidity=${context.weather.humidity ?? "unknown"}%, wind=${context.weather.windSpeedKph ?? "unknown"}kph, rain=${context.weather.rainLikely ? "likely" : "not likely"}`
      : "Weather context: unavailable",
  ];

  return {
    provider: "local_rule",
    evidenceStatus: "needs_more_evidence",
    issue: "Needs more evidence",
    findings: [],
    category: "observation",
    severity: "low",
    confidence: 0,
    summary:
      "This photo is not clear enough to confirm a disease yet. BloomPilot will wait for a stronger signal instead of guessing.",
    treatment: [],
    followUp:
      "Retake a sharper close-up of the affected area.",
    evidenceNotes,
  };
}

function buildProviderUnavailable(context: DiagnosisContext): DiseaseDiagnosisResult {
  return {
    provider: "local_rule",
    evidenceStatus: "needs_more_evidence",
    issue: "Provider unavailable",
    findings: [],
    category: "observation",
    severity: "low",
    confidence: 0,
    summary:
      "BloomPilot could not reach the diagnosis provider, so this scan could not be completed.",
    treatment: [],
    followUp: "Try the scan again once the provider is reachable.",
    evidenceNotes: [
      "Diagnosis provider was unavailable for this run.",
      `Plant: ${context.plantName} (${context.species})`,
    ],
  };
}

function normalizeSeverity(value: unknown): DiagnosisSeverity {
  const raw = String(value ?? "").toLowerCase();
  if (raw === "high") return "high";
  if (raw === "medium") return "medium";
  return "low";
}

function normalizeConfidence(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  const scaled = parsed > 0 && parsed <= 1 ? parsed * 100 : parsed;
  return Math.max(0, Math.min(100, Math.round(scaled)));
}

function extractText(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return extractText(record.local_name ?? record.name ?? record.value ?? record.label);
  }
  return "";
}

function extractArray(value: unknown) {
  if (!Array.isArray(value)) return [] as string[];
  return trimList(value.map((entry) => extractText(entry)).filter(Boolean));
}

function pickCandidate(payload: Record<string, unknown>) {
  const healthAssessment =
    payload.health_assessment && typeof payload.health_assessment === "object"
      ? (payload.health_assessment as Record<string, unknown>)
      : null;

  const diseases =
    healthAssessment?.diseases && Array.isArray(healthAssessment.diseases)
      ? (healthAssessment.diseases as unknown[])
      : [];

  if (diseases.length > 0) {
    const rankedDiseases = diseases
      .filter((disease): disease is Record<string, unknown> => Boolean(disease && typeof disease === "object"))
      .sort((left, right) => {
        const leftProbability = normalizeConfidence(left.probability ?? left.confidence ?? left.score);
        const rightProbability = normalizeConfidence(right.probability ?? right.confidence ?? right.score);
        return rightProbability - leftProbability;
      });
    const strongestDisease = rankedDiseases[0];
    if (strongestDisease) {
      return { ...strongestDisease, __assessment: healthAssessment };
    }
  }

  if (healthAssessment) {
    return healthAssessment;
  }

  const candidateSources: unknown[] = [
    payload.health_assessment,
    payload.healthAssessment,
    payload.result,
    payload.results,
    payload.disease,
    payload.diseases,
    payload.assessment,
    payload.assessments,
  ];

  for (const source of candidateSources) {
    if (Array.isArray(source) && source.length > 0) {
      const first = source[0];
      if (first && typeof first === "object") {
        return first as Record<string, unknown>;
      }
    }

    if (source && typeof source === "object") {
      return source as Record<string, unknown>;
    }
  }

  return null;
}

function pickDiseaseCandidates(payload: Record<string, unknown>) {
  const healthAssessment =
    payload.health_assessment && typeof payload.health_assessment === "object"
      ? (payload.health_assessment as Record<string, unknown>)
      : null;
  const diseases = healthAssessment?.diseases;
  if (!Array.isArray(diseases)) return [] as Record<string, unknown>[];

  return diseases
    .filter((disease): disease is Record<string, unknown> => Boolean(disease && typeof disease === "object"))
    .sort((left, right) => {
      const leftProbability = normalizeConfidence(left.probability ?? left.confidence ?? left.score);
      const rightProbability = normalizeConfidence(right.probability ?? right.confidence ?? right.score);
      return rightProbability - leftProbability;
    });
}

function getCandidateIssue(candidate: Record<string, unknown>) {
  return (
    extractText(
      candidate.disease_details && typeof candidate.disease_details === "object"
        ? (candidate.disease_details as Record<string, unknown>).local_name
        : null,
    ) ||
    extractText(candidate.common_name ?? candidate.name ?? candidate.issue ?? candidate.disease ?? candidate.title)
  );
}

function buildFromProviderResponse(
  payload: unknown,
  context: DiagnosisContext,
): DiseaseDiagnosisResult | null {
  if (!payload || typeof payload !== "object") return null;

  const record = payload as Record<string, unknown>;
  const candidate = pickCandidate(record);
  if (!candidate) return null;
  const diseaseCandidates = pickDiseaseCandidates(record);

  const assessment =
    candidate.__assessment && typeof candidate.__assessment === "object"
      ? (candidate.__assessment as Record<string, unknown>)
      : candidate;

  const healthyProbability = normalizeConfidence(
    assessment.is_healthy_probability ?? assessment.healthy_probability ?? 0,
  );
  const providerSaysHealthy = assessment.is_healthy === true;
  const confidence = normalizeConfidence(
    candidate.confidence ?? candidate.score ?? candidate.probability ?? candidate.match_score,
  );
  const diseaseProbability = confidence;
  // Only an explicit provider confirmation or a strong disease probability can
  // create a confirmed care result. A healthy=false flag alone is not enough.
  const isExplicitlyConfirmed =
    candidate.confirmed === true || candidate.is_confirmed === true;
  const isConfirmed =
    isExplicitlyConfirmed ||
    (!providerSaysHealthy && diseaseProbability >= 75);

  if (providerSaysHealthy && healthyProbability >= 75) {
    return {
      provider: "kindwise_api",
      evidenceStatus: "confirmed",
      issue: "Looks healthy",
      findings: [],
      category: "healthy",
      severity: "low",
      confidence: healthyProbability,
      summary:
        `${context.plantName} appears healthy in this scan. No confirmed disease signal is present.`,
      treatment: [
        "Keep the current watering and light setup stable.",
        "Continue normal weekly inspection for new spots or pests.",
        "Re-scan only if the symptom pattern changes.",
      ],
      followUp: "Check again after the next care cycle if new symptoms appear.",
      evidenceNotes: [
        "Provider: Kindwise",
        `Healthy probability: ${healthyProbability}%`,
        "No confirmed disease signal in the provider response.",
        `Plant: ${context.plantName} (${context.species})`,
      ],
    };
  }

  const candidateIssue = getCandidateIssue(candidate);
  const hasCandidateIssue = Boolean(candidateIssue && candidateIssue !== "Needs more evidence");
  const findings = diseaseCandidates
    .map((disease) => ({
      name: getCandidateIssue(disease),
      confidence: normalizeConfidence(disease.probability ?? disease.confidence ?? disease.score),
      category: extractText(disease.category ?? disease.group ?? disease.type) || "plant health",
    }))
    .filter((finding) => finding.name && finding.name !== "Needs more evidence")
    .slice(0, 3);
  // Preserve a named provider suggestion even when it is not strong enough to
  // trigger care. The UI can show it as a possibility without calling it a
  // diagnosis or changing the care plan.
  const issue = hasCandidateIssue ? candidateIssue : "Needs more evidence";

  const category = extractText(candidate.category ?? candidate.group ?? candidate.type) || "observation";
  const severity = normalizeSeverity(candidate.severity ?? (confidence >= 85 ? "high" : confidence >= 65 ? "medium" : "low"));
  const summary = isConfirmed
    ? extractText(
        candidate.disease_details &&
          typeof candidate.disease_details === "object"
          ? (candidate.disease_details as Record<string, unknown>).description
          : null,
      ) ||
      extractText(candidate.summary ?? candidate.description ?? candidate.message) ||
      `${context.plantName} has a confirmed plant health issue from the provider result.`
    : hasCandidateIssue
      ? `The provider suggests ${candidateIssue}, but the signal is not strong enough to confirm it yet.`
      : "The provider response is not strong enough for a confirmed diagnosis yet.";
  const treatment = trimList(
    extractArray(candidate.treatment ?? candidate.recommendations ?? candidate.actions ?? candidate.advice),
  );
  const followUp = isConfirmed
    ? extractText(candidate.followUp ?? candidate.follow_up ?? candidate.next_step) ||
      "Recheck after the next care cycle and confirm whether the symptom spreads."
    : hasCandidateIssue
      ? "Monitor the affected area and re-scan after the next care cycle."
      : "Retake a clearer close-up before treating for a specific disease.";

  return {
    provider: "kindwise_api",
    evidenceStatus: isConfirmed ? "confirmed" : "needs_more_evidence",
    issue,
    findings,
    category,
    severity: isConfirmed ? severity : "low",
    confidence: isConfirmed ? confidence : Math.min(confidence, 49),
    summary,
    treatment: isConfirmed ? treatment : [],
    followUp,
    evidenceNotes: [
      `Provider: Kindwise`,
      `Disease probability: ${diseaseProbability}%`,
      providerSaysHealthy ? `Healthy probability: ${healthyProbability}%` : "Healthy probability: unavailable",
      isConfirmed ? "Diagnosis confirmed by provider signal." : "Provider signal was too weak for a confirmed result.",
      `Plant: ${context.plantName} (${context.species})`,
      context.weather
        ? `Weather context used: humidity ${context.weather.humidity ?? "unknown"}%, rain ${context.weather.rainLikely ? "likely" : "not likely"}`
        : "Weather context: unavailable",
    ],
  };
}

async function tryKindwiseDiagnosis(context: DiagnosisContext) {
  const key = requireKindwiseKey();
  if (!key) return null;

  const url = getKindwiseUrl();
  const timeoutMs = Number(process.env.KINDWISE_TIMEOUT_MS ?? 12000);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Api-Key": key,
    },
    body: JSON.stringify({
      images: [toBase64(context.image.bytes)],
      details: ["local_name", "description", "treatment", "cause"],
      language: "en",
      similar_images: false,
      full_disease_list: false,
    }),
    signal: AbortSignal.timeout(Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 12000),
  });

  if (!response.ok) {
    throw new Error(`Kindwise returned HTTP ${response.status}`);
  }

  const payload = (await response.json()) as unknown;
  return buildFromProviderResponse(payload, context);
}

export async function analyzePlantDisease(context: DiagnosisContext): Promise<DiseaseDiagnosisResult> {
  try {
    const providerResult = await tryKindwiseDiagnosis(context);
    if (providerResult) {
      return providerResult;
    }
  } catch {
    return buildProviderUnavailable(context);
  }

  return requireKindwiseKey() ? buildNeedsMoreEvidence(context) : buildProviderUnavailable(context);
}
