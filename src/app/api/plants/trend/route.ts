import { NextResponse, type NextRequest } from "next/server";
import { requireApiSession } from "@/lib/api-session";
import { readWorkspaceIdentityByEmail } from "@/lib/workspace-store";
import { getPlantHealthHistory } from "@/lib/plant-memory";

export type TrendPoint = {
  date: string;
  score: number;
};

function computeDailyScores(
  events: { eventType: string; createdAt: string }[],
  days = 14,
): TrendPoint[] {
  const today = new Date();
  const points: TrendPoint[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);

    const dayEvents = events.filter((e) => e.createdAt.slice(0, 10) === dateStr);

    // Score starts at 50 for no data; each event type adds/subtracts
    let score = dayEvents.length === 0 ? null : 70;
    if (score !== null) {
      for (const e of dayEvents) {
        if (e.eventType === "watered") score = Math.min(100, score + 15);
        if (e.eventType === "water_skipped") score = Math.max(0, score - 10);
        if (e.eventType === "fertilized") score = Math.min(100, score + 10);
        if (e.eventType === "diagnosed") score = Math.max(0, score - 20);
        if (e.eventType === "inspected") score = Math.min(100, score + 5);
        if (e.eventType === "weather_alert") score = Math.max(0, score - 5);
      }
    }

    points.push({ date: dateStr, score: score ?? 50 });
  }

  return points;
}

export async function GET(request: NextRequest) {
  const { session, response } = await requireApiSession();
  if (!session || response) return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const identity = readWorkspaceIdentityByEmail(session.email);
  if (!identity) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const plantId = request.nextUrl.searchParams.get("plantId");
  if (!plantId) {
    return NextResponse.json({ error: "plantId required" }, { status: 400 });
  }

  const events = getPlantHealthHistory(identity.id, plantId, 100);
  const trend = computeDailyScores(events);

  return NextResponse.json({ trend });
}
