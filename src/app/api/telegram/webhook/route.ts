import { NextResponse } from "next/server";
import {
  acknowledgeTelegramConnection,
  saveTelegramChatId,
  verifyTelegramConnectToken,
} from "@/lib/telegram";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const configuredSecret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (configuredSecret && request.headers.get("x-telegram-bot-api-secret-token") !== configuredSecret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const update = await request.json().catch(() => null) as {
    message?: { chat?: { id?: number }; text?: string };
  } | null;
  const message = update?.message;
  const chatId = message?.chat?.id;
  const text = message?.text?.trim() || "";
  if (!chatId || !text.startsWith("/start")) return NextResponse.json({ ok: true });

  const token = text.slice("/start".length).trim();
  const userId = verifyTelegramConnectToken(token);
  if (!userId) {
    await acknowledgeTelegramConnection(String(chatId));
    return NextResponse.json({ ok: true });
  }

  await saveTelegramChatId(userId, String(chatId));
  await acknowledgeTelegramConnection(String(chatId));
  return NextResponse.json({ ok: true });
}
