import { getDatabase } from "@/lib/database";
import { Resend } from "resend";

const resendKey = process.env.RESEND_API_KEY?.trim();
const fromEmail = process.env.RESEND_FROM_EMAIL?.trim() ?? "noreply@bloompilot.app";
const resend = resendKey ? new Resend(resendKey) : null;

type TaskRow = { title: string; kind: string; plant_name: string };

const KIND_EMOJI: Record<string, string> = {
  water: "💧",
  feed: "🌱",
  inspect: "🔍",
};

function buildReminderHtml(userName: string, tasks: TaskRow[]): string {
  const rows = tasks
    .map(
      (t) =>
        `<tr>
          <td style="padding:8px 12px;font-size:14px;">${KIND_EMOJI[t.kind] ?? "📋"}</td>
          <td style="padding:8px 0;font-size:14px;color:#173528;font-weight:500;">${t.plant_name}</td>
          <td style="padding:8px 12px;font-size:14px;color:#647b6f;">${t.title}</td>
        </tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family:-apple-system,sans-serif;background:#f4f8f1;margin:0;padding:20px;">
  <div style="background:linear-gradient(135deg,#143427,#2d7a52);border-radius:16px;padding:24px;color:white;margin-bottom:16px;">
    <h2 style="margin:0 0 4px;color:white;">🌿 Today's garden care</h2>
    <p style="margin:0;color:rgba(255,255,255,0.75);font-size:14px;">Hi ${userName}, you have ${tasks.length} task${tasks.length !== 1 ? "s" : ""} due today.</p>
  </div>
  <div style="background:#fff;border-radius:16px;padding:24px;border:1px solid #dce7da;">
    <table style="width:100%;border-collapse:collapse;">
      ${rows}
    </table>
  </div>
  <p style="font-size:11px;color:#aaa;text-align:center;margin-top:16px;">BloomPilot · Unsubscribe in settings</p>
</body>
</html>`;
}

export async function sendDailyReminder(
  userId: number,
  userEmail: string,
  userName: string,
): Promise<{ sent: boolean; taskCount: number; reason?: string }> {
  const db = await getDatabase();

  const tasks = await db
    .prepare(
      `SELECT ct.title, ct.kind, p.nickname as plant_name
       FROM care_tasks ct
       JOIN plants p ON p.id = ct.plant_id
       WHERE ct.user_id = ? AND ct.status = 'open' AND date(ct.due_date) = date('now')
       ORDER BY ct.kind ASC`,
    )
    .all(userId) as TaskRow[];

  if (tasks.length === 0) {
    return { sent: false, taskCount: 0, reason: "No tasks due today" };
  }

  if (!resend) {
    return { sent: false, taskCount: tasks.length, reason: "Email not configured" };
  }

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  try {
    const response = await resend.emails.send({
      from: fromEmail,
      to: [userEmail],
      subject: `🌿 ${tasks.length} plant care task${tasks.length !== 1 ? "s" : ""} due today — ${today}`,
      html: buildReminderHtml(userName, tasks),
      text: `Hi ${userName}, you have ${tasks.length} task${tasks.length !== 1 ? "s" : ""} due today:\n\n${tasks.map((t) => `• ${t.plant_name}: ${t.title}`).join("\n")}`,
    });

    if (response.error) {
      return { sent: false, taskCount: tasks.length, reason: response.error.message };
    }

    return { sent: true, taskCount: tasks.length };
  } catch (err) {
    return {
      sent: false,
      taskCount: tasks.length,
      reason: err instanceof Error ? err.message : "Send failed",
    };
  }
}
