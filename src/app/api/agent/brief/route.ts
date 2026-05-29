import { NextResponse } from "next/server";
import { readOrCreateLatestAgentRun, runAgentBrief } from "@/lib/agent-runtime";
import { requestExternalAgentBrief } from "@/lib/agent-service";
import { readSession } from "@/lib/session";

export async function GET(request: Request) {
  const session = await readSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const refresh = url.searchParams.get("refresh");
  const source = url.searchParams.get("source");

  if (source === "service") {
    const serviceRun = await requestExternalAgentBrief(
      refresh === "1" ? "service-refresh" : "service-read",
    );

    if (serviceRun) {
      return NextResponse.json({ run: serviceRun, source: "service" });
    }
  }

  const run =
    refresh === "1" ? await runAgentBrief("api") : await readOrCreateLatestAgentRun();

  return NextResponse.json({ run, source: "local" });
}
