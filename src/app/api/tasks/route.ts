import { NextResponse } from "next/server";
import { readGardenState } from "@/lib/garden";
import { requireApiSession } from "@/lib/api-session";
import type { TasksResponse } from "@/lib/workspace-contracts";

export async function GET(request: Request) {
  const { response } = await requireApiSession();

  if (response) {
    return response;
  }

  const garden = await readGardenState();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const tasks =
    status === "open" || status === "done"
      ? garden.tasks.filter((task) => task.status === status)
      : garden.tasks;

  return NextResponse.json({
    tasks,
    garden,
  } satisfies TasksResponse);
}
