const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const from = process.env.TWILIO_WHATSAPP_FROM ?? "whatsapp:+14155238886";

export async function sendWhatsApp(
  to: string,
  body: string,
): Promise<{ sent: boolean; sid?: string; reason?: string }> {
  if (!accountSid || !authToken) {
    return { sent: false, reason: "Twilio credentials not configured" };
  }

  const toFormatted = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Twilio } = require("twilio") as { Twilio: new (sid: string, token: string) => { messages: { create: (opts: Record<string, string>) => Promise<{ sid: string }> } } };
    const client = new Twilio(accountSid, authToken);
    const msg = await client.messages.create({ from, to: toFormatted, body });
    return { sent: true, sid: msg.sid };
  } catch (err) {
    return { sent: false, reason: err instanceof Error ? err.message : "Send failed" };
  }
}

export function buildDailyReminderText(
  userName: string,
  tasks: { plantName: string; title: string }[],
): string {
  const lines = tasks.map((t) => `• ${t.plantName}: ${t.title}`).join("\n");
  return `🌿 *BloomPilot — Today's care*\nHi ${userName}! You have ${tasks.length} task${tasks.length !== 1 ? "s" : ""} due today:\n\n${lines}\n\nOpen the app to log completions.`;
}
