import { NextResponse } from "next/server";
import { readRecentDiagnosisRuns } from "@/lib/diagnosis";
import { readSession } from "@/lib/session";

export async function GET(request: Request) {
  const session = await readSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limitValue = Number.parseInt(searchParams.get("limit") ?? "8", 10);
  const limit = Number.isNaN(limitValue) ? 8 : Math.min(Math.max(limitValue, 1), 20);
  const runs = await readRecentDiagnosisRuns(limit);

  return NextResponse.json({
    count: runs.length,
    runs,
  });
}
