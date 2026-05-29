import { getDatabase } from "@/lib/database";
import { getGardenStats } from "@/lib/garden-stats";
import { Resend } from "resend";

const resendKey = process.env.RESEND_API_KEY?.trim();
const fromEmail = process.env.RESEND_FROM_EMAIL?.trim();
const resend = resendKey ? new Resend(resendKey) : null;

type WeekSummary = {
  waterings: number;
  skips: number;
  diagnoses: number;
  tasksCompleted: number;
  tasksDue: number;
  healthScore: number;
  upcomingCount: number;
};

function buildWeekSummary(userId: number): WeekSummary {
  const db = getDatabase();

  const waterings = (db.prepare(
    `SELECT COUNT(*) as c FROM plant_health_events WHERE user_id = ? AND event_type = 'watered' AND datetime(created_at) >= datetime('now', '-7 days')`,
  ).get(userId) as { c: number }).c;

  const skips = (db.prepare(
    `SELECT COUNT(*) as c FROM plant_health_events WHERE user_id = ? AND event_type = 'water_skipped' AND datetime(created_at) >= datetime('now', '-7 days')`,
  ).get(userId) as { c: number }).c;

  const diagnoses = (db.prepare(
    `SELECT COUNT(*) as c FROM diagnosis_runs WHERE user_id = ? AND datetime(created_at) >= datetime('now', '-7 days')`,
  ).get(userId) as { c: number }).c;

  const tasksCompleted = (db.prepare(
    `SELECT COUNT(*) as c FROM care_tasks WHERE user_id = ? AND status = 'done' AND datetime(completed_at) >= datetime('now', '-7 days')`,
  ).get(userId) as { c: number }).c;

  const tasksDue = (db.prepare(
    `SELECT COUNT(*) as c FROM care_tasks WHERE user_id = ? AND status = 'open' AND due_date <= date('now', '+7 days')`,
  ).get(userId) as { c: number }).c;

  const latestPlan = db.prepare(
    `SELECT plan_json FROM care_plans WHERE user_id = ? ORDER BY datetime(generated_at) DESC LIMIT 1`,
  ).get(userId) as { plan_json: string } | undefined;

  let healthScore = 0;
  let upcomingCount = 0;
  if (latestPlan) {
    try {
      const plan = JSON.parse(latestPlan.plan_json) as { summary?: { health_score?: number }; upcoming_tasks?: unknown[] };
      healthScore = plan.summary?.health_score ?? 0;
      upcomingCount = plan.upcoming_tasks?.length ?? 0;
    } catch { /* ignore */ }
  }

  return { waterings, skips, diagnoses, tasksCompleted, tasksDue, healthScore, upcomingCount };
}

function buildDigestHtml(userName: string, summary: WeekSummary, stats: ReturnType<typeof getGardenStats>): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><style>
  body { font-family: -apple-system, sans-serif; background: #f4f8f1; margin: 0; padding: 20px; }
  .card { background: #fff; border-radius: 16px; padding: 24px; margin-bottom: 16px; border: 1px solid #dce7da; }
  .header { background: linear-gradient(135deg, #143427, #2d7a52); border-radius: 16px; padding: 24px; color: white; margin-bottom: 16px; }
  .stat { display: inline-block; text-align: center; padding: 12px 16px; background: #f4f8f1; border-radius: 12px; margin: 4px; }
  .stat-value { font-size: 24px; font-weight: bold; color: #173528; }
  .stat-label { font-size: 11px; color: #647b6f; text-transform: uppercase; letter-spacing: 0.08em; }
  h2 { color: #173528; font-size: 18px; margin: 0 0 8px; }
  p { color: #647b6f; font-size: 14px; line-height: 1.6; margin: 0 0 8px; }
</style></head>
<body>
  <div class="header">
    <h2 style="color:white">🌿 Weekly Garden Report</h2>
    <p style="color:rgba(255,255,255,0.75)">Hi ${userName}, here's what happened in your garden this week.</p>
  </div>
  <div class="card">
    <h2>This week</h2>
    <div>
      <div class="stat"><div class="stat-value">${summary.waterings}</div><div class="stat-label">Waterings</div></div>
      <div class="stat"><div class="stat-value">${summary.tasksCompleted}</div><div class="stat-label">Tasks done</div></div>
      <div class="stat"><div class="stat-value">${summary.diagnoses}</div><div class="stat-label">Diagnoses</div></div>
      <div class="stat"><div class="stat-value">${summary.skips}</div><div class="stat-label">Skips</div></div>
    </div>
  </div>
  <div class="card">
    <h2>Garden health</h2>
    <p>Health score: <strong>${summary.healthScore}/100</strong></p>
    <p>Green thumb score: <strong>${stats.greenThumbScore}/100</strong> · Care streak: <strong>${stats.careStreak} days</strong></p>
  </div>
  <div class="card">
    <h2>Next week</h2>
    <p>${summary.tasksDue} tasks due in the next 7 days. Keep up the routine!</p>
  </div>
  <p style="font-size:11px;color:#aaa;text-align:center;margin-top:16px">BloomPilot · Unsubscribe in settings</p>
</body>
</html>`;
}

export async function sendWeeklyDigest(userId: number, userEmail: string, userName: string): Promise<{ sent: boolean; reason?: string }> {
  if (!resend || !fromEmail) {
    return { sent: false, reason: "Email not configured" };
  }

  const summary = buildWeekSummary(userId);
  const stats = getGardenStats(userId);
  const html = buildDigestHtml(userName, summary, stats);

  try {
    await resend.emails.send({
      from: fromEmail,
      to: [userEmail],
      subject: `🌿 Your weekly garden report — ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric" })}`,
      html,
      text: `Weekly garden report: ${summary.waterings} waterings, ${summary.tasksCompleted} tasks done, health score ${summary.healthScore}/100. ${summary.tasksDue} tasks due next week.`,
    });
    return { sent: true };
  } catch (err) {
    return { sent: false, reason: err instanceof Error ? err.message : "Send failed" };
  }
}
