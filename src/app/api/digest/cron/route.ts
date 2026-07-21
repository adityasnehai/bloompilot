import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/database";
import { sendWeeklyDigest } from "@/lib/weekly-digest";
import { withApiHandler } from "@/lib/api-handler";

export const runtime = "nodejs";

export const GET = withApiHandler(async (req: NextRequest) => {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = await getDatabase();
  const users = await db
    .prepare(`SELECT id, email, name FROM users WHERE onboarded = 1 AND (email_weekly_digest IS NULL OR email_weekly_digest = 1)`)
    .all() as { id: number; email: string; name: string }[];

  const results: { email: string; sent: boolean; reason?: string }[] = [];

  for (const user of users) {
    const result = await sendWeeklyDigest(user.id, user.email, user.name);
    results.push({ email: user.email, ...result });
  }

  return NextResponse.json({ processed: results.length, results });
});
