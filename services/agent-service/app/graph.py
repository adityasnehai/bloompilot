from __future__ import annotations

from datetime import date, datetime
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
    today = date.today().isoformat()
    return sorted(
        [
            task for task in tasks
            if task.get("status") == "open" and str(task.get("dueDate", ""))[:10] <= today
        ],
        key=lambda task: str(task.get("dueDate", "")),
    )[:3]


def _build_brief(state: BriefState) -> BriefState:
    request = state["request"]
    garden = request.workspace.garden
    priorities = _due_now([task.model_dump() for task in garden.tasks])
    priority_ids = {task["id"] for task in priorities}
    today = date.today().isoformat()
    focus = [
        {
            "id": plant.id,
            "nickname": plant.nickname,
            "species": plant.species,
            "careReadiness": max(0, 100 - sum(20 for task in garden.tasks if task.plantId == plant.id and task.status == "open" and str(task.dueDate)[:10] < today)),
            "openCount": sum(1 for task in garden.tasks if task.plantId == plant.id and task.status == "open"),
            "overdueCount": sum(1 for task in garden.tasks if task.plantId == plant.id and task.status == "open" and str(task.dueDate)[:10] < today),
            "recommendation": (
                f"Complete {plant.nickname}'s overdue care first."
                if any(task["id"] in priority_ids and task.get("plantId") == plant.id and str(task.get("dueDate", ""))[:10] < today for task in priorities)
                else f"No overdue care is recorded for {plant.nickname}."
            ),
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
            "This brief is derived only from the submitted workspace snapshot.",
            "Use the local web application to complete care and deliver notifications.",
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
    deliveries = []
    if open_tasks:
        deliveries.append({
            "id": "care-candidates",
            "channel": "in_app",
            "status": "candidate",
            "title": "Care candidates for local delivery",
            "preview": f"{len(open_tasks[:4])} open task(s) found in the workspace snapshot.",
            "scheduledWindow": "Caller must apply delivery policy",
            "items": [task["title"] for task in open_tasks[:4]],
        })
    today = date.today().isoformat()
    overdue = [task for task in open_tasks if str(task.get("dueDate", ""))[:10] < today]
    payload = ReminderRunPayload(
        headline="External reminder sweep prepared.",
        summary=f"LangGraph staged reminder output for {len(garden.plants)} plant(s).",
        deliveryCount=len(deliveries),
        urgentCount=len(overdue),
        deliveries=deliveries,
        notes=[
            f"Request trigger: {request.trigger}.",
            f"Generated at {datetime.utcnow().isoformat()}Z.",
            "No notification was sent by the external service.",
        ],
    )
    return {"request": request, "payload": payload}


def _build_diagnosis(state: DiagnosisState) -> DiagnosisState:
    request = state["request"]
    payload = DiagnosisResult(
        issue="Needs more evidence",
        category="observation",
        severity="low",
        confidence=0,
        evidenceStatus="needs_more_evidence",
        provider="external_agent",
        summary=(
            f"The external service cannot confirm a condition for {request.plantNickname} "
            "because no plant image was provided. Use the web diagnosis flow for an image-backed assessment."
        ),
        treatment=[],
        followUp="Upload a clear image through the web diagnosis flow before treating the plant.",
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
