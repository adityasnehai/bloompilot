import { NextResponse } from "next/server";
import { runAlertObserver } from "@/lib/alert-observer";
import { readAllActiveUsers } from "@/lib/workspace-store";

// Called by Vercel Cron (configured in vercel.json) every 4 hours.
// Protected by CRON_SECRET so only the scheduler can trigger it.
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET?.trim();

  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const users = await readAllActiveUsers();

  const results = await Promise.allSettled(
    users.map((user) => runAlertObserver(user.id, user.email)),
  );

  const summary = results.map((result, i) => ({
    userId: users[i].id,
    status: result.status,
    alertsGenerated: result.status === "fulfilled" ? result.value.alertsGenerated : 0,
    alertsFired: result.status === "fulfilled" ? result.value.alertsFired : 0,
    error: result.status === "rejected" ? String(result.reason) : undefined,
  }));

  return NextResponse.json({ ran: users.length, summary });
}
