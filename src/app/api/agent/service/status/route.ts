import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/api-session";
import { readAgentServiceStatus } from "@/lib/agent-service";
import { withApiHandler } from "@/lib/api-handler";

export const GET = withApiHandler(async () => {
  const { response } = await requireApiSession({ requireOnboarded: false });

  if (response) {
    return response;
  }

  return NextResponse.json(readAgentServiceStatus());
});
