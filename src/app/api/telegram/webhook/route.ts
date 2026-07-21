import { NextResponse } from "next/server";
import { z } from "zod";
import {
  acknowledgeTelegramConnection,
  saveTelegramChatId,
  verifyTelegramConnectToken,
} from "@/lib/telegram";
import { withApiHandler } from "@/lib/api-handler";

export const runtime = "nodejs";

const telegramUpdateSchema = z.object({
  message: z
    .object({
      chat: z.object({ id: z.number() }).optional(),
      text: z.string().optional(),
    })
    .optional(),
});

export const POST = withApiHandler(async (request: Request) => {
  const configuredSecret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (configuredSecret && request.headers.get("x-telegram-bot-api-secret-token") !== configuredSecret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const rawBody = await request.json().catch(() => null);
  const parsed = telegramUpdateSchema.safeParse(rawBody);
  // Telegram sends many update types we don't handle (edited messages, callbacks,
  // etc.) — an update that doesn't match our shape is simply not one we act on,
  // not an error worth a 400 (Telegram would just retry the webhook).
  if (!parsed.success) return NextResponse.json({ ok: true });

  const message = parsed.data.message;
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
});
