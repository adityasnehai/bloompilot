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

  const body = await req.json().catch(() => null) as { taskIds?: unknown; action?: unknown } | null;
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  const { taskIds, action } = body;

  if (!Array.isArray(taskIds) || taskIds.length === 0 || taskIds.length > 100 || taskIds.some((id) => typeof id !== "string" || !id.trim())) {
    return NextResponse.json({ error: "taskIds required" }, { status: 400 });
  }
  if (action !== "done") {
    return NextResponse.json({ error: "Only completing tasks is supported" }, { status: 400 });
  }

  let gardenState = await readGardenState();
  const userId = await getCurrentWorkspaceUserId();
  let processed = 0;

  for (const taskId of taskIds as string[]) {
    const task = gardenState.tasks.find((t) => t.id === taskId);
    if (!task || task.status !== "open") continue;

    gardenState = toggleTaskStatus(gardenState, taskId);
    processed += 1;

    if (userId) {
      const plant = gardenState.plants.find((p) => p.id === task.plantId);
      if (plant) {
        const eventTypeMap: Partial<Record<string, HealthEventType>> = {
          water: "watered",
          inspect: "inspected",
          feed: "fertilized",
        };
        const eventType = eventTypeMap[task.kind];
        if (eventType) {
          await logHealthEvent(userId, plant.id, plant.nickname, eventType, `Batch ${action}: ${task.title}`, {
            taskId: task.id,
            kind: task.kind,
            dueDate: task.dueDate,
          });
        }
      }
    }
  }

  await writeGardenState(gardenState);
  return NextResponse.json({ ok: true, processed });
}
