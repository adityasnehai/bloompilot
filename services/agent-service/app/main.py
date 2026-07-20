from __future__ import annotations

from datetime import datetime, timezone
import os

from fastapi import Depends, FastAPI, Header, HTTPException

from .graph import run_brief, run_diagnosis, run_reminders
from .models import BriefRequest, DiagnosisPayload, ReminderRequest

app = FastAPI(title="BloomPilot Agent Service", version="0.1.0")


def require_service_key(x_agent_service_key: str | None = Header(default=None)) -> None:
    expected = os.getenv("AGENT_SERVICE_API_KEY", "").strip()
    if not expected:
        raise HTTPException(status_code=503, detail="AGENT_SERVICE_API_KEY is not configured")
    if x_agent_service_key != expected:
        raise HTTPException(status_code=401, detail="Unauthorized")


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "service": "bloompilot-agent-service",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.post("/brief", dependencies=[Depends(require_service_key)])
def brief(request: BriefRequest) -> dict:
    return {
        "trigger": request.trigger,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "payload": run_brief(request).model_dump(),
    }


@app.post("/reminders/sweep", dependencies=[Depends(require_service_key)])
def reminders(request: ReminderRequest) -> dict:
    return {
        "trigger": request.trigger,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "payload": run_reminders(request).model_dump(),
    }


@app.post("/diagnosis", dependencies=[Depends(require_service_key)])
def diagnosis(request: DiagnosisPayload) -> dict:
    return {
        "trigger": "service",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "payload": run_diagnosis(request).model_dump(),
    }
