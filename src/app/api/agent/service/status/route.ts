import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/api-session";
import { readAgentServiceStatus } from "@/lib/agent-service";

export async function GET() {
  const { response } = await requireApiSession({ requireOnboarded: false });

  if (response) {
    return response;
  }

  return NextResponse.json(readAgentServiceStatus());
}
