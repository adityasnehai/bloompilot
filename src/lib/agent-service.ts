import type { AgentRunPayload, StoredAgentRun } from "@/lib/agent-runtime";
import { readRecentDiagnosisRuns } from "@/lib/diagnosis";
import { readGardenState } from "@/lib/garden";
import { readLatestAgentRun } from "@/lib/agent-runtime";
import type { ReminderRunPayload, StoredReminderRun } from "@/lib/reminders";
import { readLatestReminderRun } from "@/lib/reminders";
import type {
  AgentServiceStatusResponse,
  WorkspaceEnvelope,
} from "@/lib/workspace-contracts";

type ExternalRunEnvelope<TPayload> = {
  trigger: string;
  createdAt: string;
  payload: TPayload;
};

function getAgentServiceBaseUrl() {
  const raw = process.env.AGENT_SERVICE_URL?.trim();

  if (!raw) {
    return null;
  }

  return raw.replace(/\/+$/, "");
}

export async function buildWorkspaceEnvelope(): Promise<WorkspaceEnvelope> {
  const [garden, latestAgentRun, latestReminderRun, diagnoses] = await Promise.all([
    readGardenState(),
    readLatestAgentRun(),
    readLatestReminderRun(),
    readRecentDiagnosisRuns(6),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    garden,
    latestAgentRun,
    latestReminderRun,
    diagnoses,
  };
}

export function readAgentServiceStatus(): AgentServiceStatusResponse {
  const baseUrl = getAgentServiceBaseUrl();

  return {
    enabled: Boolean(baseUrl),
    mode: baseUrl ? "external" : "local",
    url: baseUrl,
    endpoints: {
      health: baseUrl ? `${baseUrl}/health` : null,
      brief: baseUrl ? `${baseUrl}/brief` : null,
      reminders: baseUrl ? `${baseUrl}/reminders/sweep` : null,
      diagnosis: baseUrl ? `${baseUrl}/diagnosis` : null,
    },
  };
}

async function postToService<TPayload>(
  path: string,
  body: Record<string, unknown>,
): Promise<ExternalRunEnvelope<TPayload> | null> {
  const baseUrl = getAgentServiceBaseUrl();

  if (!baseUrl) {
    return null;
  }

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as ExternalRunEnvelope<TPayload>;
  } catch {
    return null;
  }
}

export async function requestExternalAgentBrief(trigger = "api"): Promise<StoredAgentRun | null> {
  const workspace = await buildWorkspaceEnvelope();
  const result = await postToService<AgentRunPayload>("/brief", {
    trigger,
    workspace,
  });

  if (!result) {
    return null;
  }

  return {
    id: crypto.randomUUID(),
    trigger: result.trigger,
    createdAt: result.createdAt,
    payload: result.payload,
  };
}

export async function requestExternalReminderSweep(
  trigger = "api",
): Promise<StoredReminderRun | null> {
  const workspace = await buildWorkspaceEnvelope();
  const result = await postToService<ReminderRunPayload>("/reminders/sweep", {
    trigger,
    workspace,
  });

  if (!result) {
    return null;
  }

  return {
    id: crypto.randomUUID(),
    trigger: result.trigger,
    createdAt: result.createdAt,
    payload: result.payload,
  };
}
