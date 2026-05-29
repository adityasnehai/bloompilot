from __future__ import annotations

from datetime import datetime, timezone

from fastapi import FastAPI

from .graph import run_brief, run_diagnosis, run_reminders
from .models import BriefRequest, DiagnosisPayload, ReminderRequest

app = FastAPI(title="BloomPilot Agent Service", version="0.1.0")


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "service": "bloompilot-agent-service",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.post("/brief")
def brief(request: BriefRequest) -> dict:
    return {
        "trigger": request.trigger,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "payload": run_brief(request).model_dump(),
    }


@app.post("/reminders/sweep")
def reminders(request: ReminderRequest) -> dict:
    return {
        "trigger": request.trigger,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "payload": run_reminders(request).model_dump(),
    }


@app.post("/diagnosis")
def diagnosis(request: DiagnosisPayload) -> dict:
    return {
        "trigger": "service",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "payload": run_diagnosis(request).model_dump(),
    }
