import { createHmac, timingSafeEqual } from "node:crypto";
import type { ReminderSendPayload, ReminderSendResult } from "@/lib/notifications/types";
import { getDatabase } from "@/lib/database";

const TELEGRAM_API = "https://api.telegram.org";
const CONNECT_TOKEN_TTL_SECONDS = 15 * 60;

function botToken() {
  return process.env.TELEGRAM_BOT_TOKEN?.trim() || null;
}

function connectSecret() {
  return process.env.TELEGRAM_CONNECT_SECRET?.trim() || process.env.SESSION_SECRET?.trim() || "bloompilot-telegram-development-secret";
}

function botUsername() {
  return process.env.TELEGRAM_BOT_USERNAME?.trim().replace(/^@/, "") || null;
}

function sign(value: string) {
  return createHmac("sha256", connectSecret()).update(value).digest("base64url");
}

export function createTelegramConnectLink(userId: number) {
  const username = botUsername();
  if (!username) return null;

  const payload = `${userId}.${Math.floor(Date.now() / 1000)}`;
  const token = `${Buffer.from(payload).toString("base64url")}.${sign(payload)}`;
  return `https://t.me/${username}?start=${token}`;
}

export function verifyTelegramConnectToken(token: string) {
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;

  try {
    const payload = Buffer.from(encodedPayload, "base64url").toString("utf8");
    const expected = sign(payload);
    const valid = timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    if (!valid) return null;

    const [userIdRaw, createdAtRaw] = payload.split(".");
    const userId = Number(userIdRaw);
    const createdAt = Number(createdAtRaw);
    if (!Number.isInteger(userId) || userId <= 0 || !Number.isFinite(createdAt)) return null;
    if (Math.floor(Date.now() / 1000) - createdAt > CONNECT_TOKEN_TTL_SECONDS) return null;
    return userId;
  } catch {
    return null;
  }
}

export function readTelegramChatId(userId: number) {
  const row = getDatabase()
    .prepare("SELECT telegram_chat_id FROM users WHERE id = ? LIMIT 1")
    .get(userId) as { telegram_chat_id: string | null } | undefined;
  return row?.telegram_chat_id ?? null;
}

export function saveTelegramChatId(userId: number, chatId: string) {
  getDatabase()
    .prepare("UPDATE users SET telegram_chat_id = ?, updated_at = ? WHERE id = ?")
    .run(chatId, new Date().toISOString(), userId);
}

async function sendTelegramText(chatId: string, text: string) {
  const token = botToken();
  if (!token) return { ok: false, description: "Telegram bot token is missing." };

  const response = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
    signal: AbortSignal.timeout(10_000),
  });
  const body = (await response.json().catch(() => null)) as { ok?: boolean; description?: string } | null;
  return {
    ok: response.ok && body?.ok === true,
    description: body?.description || (response.ok ? undefined : `Telegram API returned HTTP ${response.status}.`),
  };
}

export async function sendTelegramReminder(params: {
  chatId: string;
  payload: ReminderSendPayload;
}): Promise<ReminderSendResult> {
  const items = params.payload.items.length > 0
    ? `\n\n${params.payload.items.map((item) => `• ${item}`).join("\n")}`
    : "";
  const result = await sendTelegramText(
    params.chatId,
    `🌿 ${params.payload.title}\n${params.payload.message}${items}`,
  );

  if (result.ok) return { status: "sent" };
  return {
    status: "failed",
    error_code: "telegram_send_failed",
    error_message: result.description || "Telegram message failed.",
  };
}

export async function sendTelegramTest(chatId: string) {
  return sendTelegramText(chatId, "🌿 BloomPilot test\nTelegram reminders are connected.");
}

export async function acknowledgeTelegramConnection(chatId: string) {
  return sendTelegramText(chatId, "BloomPilot is connected. You will receive plant-care reminders here.");
}
