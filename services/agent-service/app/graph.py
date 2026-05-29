from __future__ import annotations

from datetime import datetime
from typing import TypedDict

from langgraph.graph import END, START, StateGraph

from .models import (
    AgentRunPayload,
    BriefRequest,
    DiagnosisPayload,
    DiagnosisResult,
    ReminderRequest,
    ReminderRunPayload,
)


class BriefState(TypedDict, total=False):
    request: BriefRequest
    payload: AgentRunPayload


class ReminderState(TypedDict, total=False):
    request: ReminderRequest
    payload: ReminderRunPayload


class DiagnosisState(TypedDict, total=False):
    request: DiagnosisPayload
    payload: DiagnosisResult


def _due_now(tasks: list[dict]) -> list[dict]:
    return [task for task in tasks if task.get("status") == "open"][:3]


def _build_brief(state: BriefState) -> BriefState:
    request = state["request"]
    garden = request.workspace.garden
    priorities = _due_now([task.model_dump() for task in garden.tasks])
    focus = [
        {
            "id": plant.id,
            "nickname": plant.nickname,
            "species": plant.species,
            "score": max(60, 94 - len(priorities) * 4),
            "openCount": len(priorities),
            "overdueCount": 0,
            "recommendation": f"Keep {plant.nickname} inside the first half of the care window.",
        }
        for plant in garden.plants[:3]
    ]
    payload = AgentRunPayload(
        headline=(
            "External service brief is active."
            if garden.plants
            else "No plants loaded into the external service payload."
        ),
        overview=(
            f"LangGraph processed {len(garden.plants)} plants and {len(garden.tasks)} tasks for this workspace snapshot."
        ),
        priorities=priorities,
        focusPlants=focus,
        recommendations=[
            "External orchestration is now available for web and mobile clients.",
            "Use the shared workspace payload to keep multiple surfaces in sync.",
        ],
        recap=[
            f"Request trigger: {request.trigger}.",
            f"Workspace generated at {request.workspace.generatedAt}.",
        ],
    )
    return {"request": request, "payload": payload}


def _build_reminders(state: ReminderState) -> ReminderState:
    request = state["request"]
    garden = request.workspace.garden
    open_tasks = [task.model_dump() for task in garden.tasks if task.status == "open"]
    deliveries = [
        {
            "id": f"delivery-{index}",
            "channel": channel,
            "status": "ready",
            "title": f"{channel.title()} reminder batch ready",
            "preview": f"{len(open_tasks[:4])} task(s) staged from the shared workspace payload.",
            "scheduledWindow": "External service",
            "items": [task["title"] for task in open_tasks[:4]] or ["No open care tasks in queue."],
        }
        for index, channel in enumerate(["email", "push"], start=1)
    ]
    payload = ReminderRunPayload(
        headline="External reminder sweep prepared.",
        summary=f"LangGraph staged reminder output for {len(garden.plants)} plant(s).",
        deliveryCount=len(deliveries),
        urgentCount=len(open_tasks[:4]),
        deliveries=deliveries,
        notes=[
            f"Request trigger: {request.trigger}.",
            f"Generated at {datetime.utcnow().isoformat()}Z.",
        ],
    )
    return {"request": request, "payload": payload}


def _build_diagnosis(state: DiagnosisState) -> DiagnosisState:
    request = state["request"]
    symptoms = {symptom.lower() for symptom in request.symptoms}
    observation = request.observation.lower()

    if "webbing" in symptoms:
        payload = DiagnosisResult(
            issue="Spider mite pressure",
            category="pest",
            severity="high",
            confidence=91,
            summary=f"{request.plantNickname} likely has spider mite activity based on webbing in the uploaded report.",
            treatment=[
                "Isolate the plant from the rest of the collection.",
                "Rinse leaf undersides thoroughly.",
                "Repeat a targeted pest treatment within one week.",
            ],
            followUp="Inspect leaf joints again in 48 hours.",
        )
    elif "powdery_residue" in symptoms or "powder" in observation:
        payload = DiagnosisResult(
            issue="Powdery mildew risk",
            category="fungal",
            severity="high",
            confidence=87,
            summary=f"{request.plantNickname} is showing a likely fungal residue pattern.",
            treatment=[
                "Improve airflow around the plant.",
                "Keep foliage dry during watering.",
                "Apply a targeted fungicidal treatment.",
            ],
            followUp="Check spread again after the next watering cycle.",
        )
    else:
        payload = DiagnosisResult(
            issue="General plant stress",
            category="observation",
            severity="low",
            confidence=63,
            summary=f"{request.plantNickname} shows a mild stress signal with limited evidence.",
            treatment=[
                "Stay on the normal care cadence.",
                "Capture a clearer follow-up photo in brighter light.",
                "Compare the affected area after the next care cycle.",
            ],
            followUp="Re-run diagnosis if symptoms intensify.",
        )

    return {"request": request, "payload": payload}


def _compile_graph(builder_cls, state_type, node_name, node_fn):
    graph = StateGraph(state_type)
    graph.add_node(node_name, node_fn)
    graph.add_edge(START, node_name)
    graph.add_edge(node_name, END)
    return graph.compile()


brief_graph = _compile_graph(StateGraph, BriefState, "build_brief", _build_brief)
reminder_graph = _compile_graph(
    StateGraph, ReminderState, "build_reminders", _build_reminders
)
diagnosis_graph = _compile_graph(
    StateGraph, DiagnosisState, "build_diagnosis", _build_diagnosis
)


def run_brief(request: BriefRequest) -> AgentRunPayload:
    result = brief_graph.invoke({"request": request})
    return result["payload"]


def run_reminders(request: ReminderRequest) -> ReminderRunPayload:
    result = reminder_graph.invoke({"request": request})
    return result["payload"]


def run_diagnosis(request: DiagnosisPayload) -> DiagnosisResult:
    result = diagnosis_graph.invoke({"request": request})
    return result["payload"]
