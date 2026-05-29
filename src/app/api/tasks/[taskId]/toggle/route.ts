import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/api-session";
import { toggleTaskMutation } from "@/lib/workspace-mutations";

export async function POST(
  _request: Request,
  context: { params: Promise<{ taskId: string }> },
) {
  const { response } = await requireApiSession();

  if (response) {
    return response;
  }

  const { taskId } = await context.params;

  if (!taskId) {
    return NextResponse.json({ error: "Missing task id" }, { status: 400 });
  }

  const result = await toggleTaskMutation(taskId);

  return NextResponse.json({
    ok: true,
    garden: result.garden,
    task: result.task,
  });
}
