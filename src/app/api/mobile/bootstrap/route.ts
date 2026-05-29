import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/api-session";
import {
  buildWorkspaceEnvelope,
  readAgentServiceStatus,
} from "@/lib/agent-service";

export async function GET() {
  const { response } = await requireApiSession();

  if (response) {
    return response;
  }

  const [workspace, service] = await Promise.all([
    buildWorkspaceEnvelope(),
    Promise.resolve(readAgentServiceStatus()),
  ]);

  return NextResponse.json({
    workspace,
    service,
  });
}
