import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/database";
import { sendDailyReminder } from "@/lib/daily-reminder";
import { sendWhatsApp, buildDailyReminderText } from "@/lib/whatsapp";

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

  const db = getDatabase();

  type UserRow = { id: number; email: string; name: string; whatsapp_number: string | null };
  const users = db
    .prepare(`SELECT id, email, name, whatsapp_number FROM users WHERE onboarded = 1 AND (email_daily_reminder IS NULL OR email_daily_reminder = 1)`)
    .all() as UserRow[];

  const whatsappUsers = db
    .prepare(`SELECT id, name, whatsapp_number FROM users WHERE onboarded = 1 AND whatsapp_number IS NOT NULL AND whatsapp_number != ''`)
    .all() as { id: number; name: string; whatsapp_number: string }[];

  const emailResults = await Promise.allSettled(
    users.map((u) => sendDailyReminder(u.id, u.email, u.name)),
  );

  // Send WhatsApp to users who have a number saved
  const whatsappResults = await Promise.allSettled(
    whatsappUsers.map(async (u) => {
      const tasks = db
        .prepare(
          `SELECT ct.title, p.nickname as plant_name FROM care_tasks ct
           JOIN plants p ON p.id = ct.plant_id
           WHERE ct.user_id = ? AND ct.status = 'open' AND date(ct.due_date) = date('now')`,
        )
        .all(u.id) as { title: string; plant_name: string }[];
      if (tasks.length === 0) return { sent: false, reason: "No tasks" };
      const text = buildDailyReminderText(u.name, tasks.map((t) => ({ plantName: t.plant_name, title: t.title })));
      return sendWhatsApp(u.whatsapp_number, text);
    }),
  );

  const summary = emailResults.map((r, i) => ({
    email: users[i].email,
    ...(r.status === "fulfilled" ? r.value : { sent: false, taskCount: 0, reason: String(r.reason) }),
  }));

  const whatsappSummary = whatsappResults.map((r, i) => ({
    number: whatsappUsers[i].whatsapp_number,
    ...(r.status === "fulfilled" ? r.value : { sent: false, reason: String(r.reason) }),
  }));

  return NextResponse.json({ processed: users.length, summary, whatsapp: whatsappSummary });
}
