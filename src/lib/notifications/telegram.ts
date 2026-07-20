import type { ReminderSendPayload, ReminderSendResult } from "@/lib/notifications/types";
import { sendTelegramReminder } from "@/lib/telegram";

export async function sendTelegramNotification(params: {
  chatId: string | null;
  payload: ReminderSendPayload;
}): Promise<ReminderSendResult> {
  if (!params.chatId) {
    return {
      status: "failed",
      error_code: "missing_telegram_connection",
      error_message: "Connect Telegram before selecting Telegram reminders.",
    };
  }

  return sendTelegramReminder({ chatId: params.chatId, payload: params.payload });
}
