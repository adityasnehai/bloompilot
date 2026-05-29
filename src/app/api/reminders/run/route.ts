import { NextResponse } from "next/server";
import { requestExternalReminderSweep } from "@/lib/agent-service";
import {
  readOrCreateLatestReminderRun,
  runReminderSweep,
} from "@/lib/reminders";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const refresh = searchParams.get("refresh") === "1";
  const source = searchParams.get("source");

  if (source === "service") {
    const serviceRun = await requestExternalReminderSweep(
      refresh ? "service-refresh" : "service-read",
    );

    if (serviceRun) {
      return NextResponse.json({ ...serviceRun, source: "service" });
    }
  }

  const run = refresh ? await runReminderSweep("api") : await readOrCreateLatestReminderRun();

  if (!run) {
    return NextResponse.json(
      { error: "Unauthorized reminder run request." },
      { status: 401 },
    );
  }

  return NextResponse.json({ ...run, source: "local" });
}
