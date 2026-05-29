import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/api-session";
import {
  getCurrentWorkspaceUserId,
  readGardenState,
  writeGardenState,
  toggleTaskStatus,
} from "@/lib/garden";
import { logHealthEvent, type HealthEventType } from "@/lib/plant-memory";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { response } = await requireApiSession();
  if (response) return response;

  const body = (await req.json()) as { taskIds: string[]; action: "done" | "skip" };
  const { taskIds, action } = body;

  if (!Array.isArray(taskIds) || taskIds.length === 0) {
    return NextResponse.json({ error: "taskIds required" }, { status: 400 });
  }
  if (action !== "done" && action !== "skip") {
    return NextResponse.json({ error: "action must be done or skip" }, { status: 400 });
  }

  let gardenState = await readGardenState();
  const userId = await getCurrentWorkspaceUserId();

  for (const taskId of taskIds) {
    const task = gardenState.tasks.find((t) => t.id === taskId);
    if (!task || task.status !== "open") continue;

    gardenState = toggleTaskStatus(gardenState, taskId);

    if (userId) {
      const plant = gardenState.plants.find((p) => p.id === task.plantId);
      if (plant) {
        const eventTypeMap: Partial<Record<string, HealthEventType>> = {
          water: action === "done" ? "watered" : "water_skipped",
          inspect: action === "done" ? "inspected" : undefined,
          feed: action === "done" ? "fertilized" : undefined,
        };
        const eventType = eventTypeMap[task.kind];
        if (eventType) {
          logHealthEvent(userId, plant.id, plant.nickname, eventType, `Batch ${action}: ${task.title}`, {
            taskId: task.id,
            kind: task.kind,
            dueDate: task.dueDate,
          });
        }
      }
    }
  }

  await writeGardenState(gardenState);
  return NextResponse.json({ ok: true, processed: taskIds.length });
}
