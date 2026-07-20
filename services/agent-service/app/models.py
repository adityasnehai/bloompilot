from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


Severity = Literal["low", "medium", "high"]


class Plant(BaseModel):
    id: str
    nickname: str
    species: str
    placement: str
    sunlight: str
    wateringIntervalDays: int
    notes: str = ""


class CareTask(BaseModel):
    id: str
    plantId: str
    title: str
    kind: str
    status: str
    dueDate: str
    createdAt: str
    completedAt: str | None = None


class GardenState(BaseModel):
    plants: list[Plant]
    tasks: list[CareTask]
    activities: list[dict] = Field(default_factory=list)
    lastUpdated: str


class AgentRunPayload(BaseModel):
    headline: str
    overview: str
    priorities: list[dict]
    focusPlants: list[dict]
    recommendations: list[str]
    recap: list[str]


class ReminderRunPayload(BaseModel):
    headline: str
    summary: str
    deliveryCount: int
    urgentCount: int
    deliveries: list[dict]
    notes: list[str]


class DiagnosisPayload(BaseModel):
    plantNickname: str
    plantSpecies: str
    symptoms: list[str] = Field(default_factory=list)
    observation: str = ""


class DiagnosisResult(BaseModel):
    issue: str = "Needs more evidence"
    category: str = "observation"
    severity: Severity = "low"
    confidence: int = 0
    evidenceStatus: Literal["confirmed", "needs_more_evidence"] = "needs_more_evidence"
    provider: str = "external_agent"
    summary: str
    treatment: list[str] = Field(default_factory=list)
    followUp: str


class WorkspaceEnvelope(BaseModel):
    generatedAt: str
    garden: GardenState
    latestAgentRun: dict | None = None
    latestReminderRun: dict | None = None
    diagnoses: list[dict] = Field(default_factory=list)


class BriefRequest(BaseModel):
    trigger: str = "api"
    workspace: WorkspaceEnvelope


class ReminderRequest(BaseModel):
    trigger: str = "api"
    workspace: WorkspaceEnvelope
