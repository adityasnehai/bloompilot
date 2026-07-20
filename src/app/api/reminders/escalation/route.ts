import { NextRequest, NextResponse } from "next/server";
import {
  isReminderWindowActive,
  readAllReminderUserProfiles,
  runReminderSweepForUserId,
} from "@/lib/reminders";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const users = readAllReminderUserProfiles();
  const activeUsers = users.filter((user) => isReminderWindowActive(user));
  const runs = [];

  for (const user of activeUsers) {
    const run = await runReminderSweepForUserId(user.userId, "escalation-cron");
    if (!run) continue;

    const escalationSuppressed = run.payload.suppression_reasons.filter(
      (reason) =>
        reason.reason === "max_escalations_per_plant_per_day_reached" ||
        reason.reason === "not_due_in_window_yet",
    ).length;

    runs.push({
      user_id: user.userId,
      email: user.email,
      sent_count: run.payload.sent_count,
      queued_count: run.payload.queued_count,
      failed_count: run.payload.failed_count,
      escalation_related_suppressions: escalationSuppressed,
    });
  }

  return NextResponse.json({
    total_users: users.length,
    active_window_users: activeUsers.length,
    processed_runs: runs.length,
    runs,
  });
}
