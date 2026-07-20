# BloomPilot Agent Service

Optional external orchestration service for BloomPilot.

## Purpose

This package externalizes the gardening agent runtime so the web app and a future
mobile client can call the same agent layer.

## Stack

- FastAPI
- LangGraph
- Pydantic

## Run

```bash
cd services/agent-service
python -m venv .venv
source .venv/bin/activate
pip install -e .
uvicorn app.main:app --reload --port 8001
```

Then set:

```bash
AGENT_SERVICE_URL=http://127.0.0.1:8001
AGENT_SERVICE_API_KEY=use-the-same-long-random-value-in-both-services
```

## Endpoints

- `GET /health`
- `POST /brief`
- `POST /reminders/sweep`
- `POST /diagnosis`

All non-health endpoints require the `X-Agent-Service-Key` header. The service
does not send notifications or diagnose from symptoms alone; it returns
workspace-derived candidates and evidence-limited results for the caller to
process through the real web application providers.
