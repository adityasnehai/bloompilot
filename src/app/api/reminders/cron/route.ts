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

  const allUsers = readAllReminderUserProfiles();
  const activeUsers = allUsers.filter((user) => isReminderWindowActive(user));
  const runs = [];

  for (const user of activeUsers) {
    const run = await runReminderSweepForUserId(user.userId, "cron");
    if (!run) continue;
    runs.push({
      user_id: user.userId,
      email: user.email,
      sent_count: run.payload.sent_count,
      queued_count: run.payload.queued_count,
      suppressed_count: run.payload.suppressed_count,
      failed_count: run.payload.failed_count,
    });
  }

  return NextResponse.json({
    total_users: allUsers.length,
    active_window_users: activeUsers.length,
    processed_runs: runs.length,
    runs,
  });
}
