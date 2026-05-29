import type { ReminderSendPayload, ReminderSendResult } from "@/lib/notifications/types";
import { sendWhatsApp } from "@/lib/whatsapp";

export async function queueWhatsAppReminder(params: {
  toNumber: string | null;
  payload: ReminderSendPayload;
}): Promise<ReminderSendResult> {
  if (!params.toNumber) {
    return {
      status: "failed",
      error_code: "missing_phone",
      error_message: "User has no WhatsApp number on file.",
    };
  }

  const items = params.payload.items.length > 0 ? `\n\n${params.payload.items.map((i) => `• ${i}`).join("\n")}` : "";
  const body = `🌿 *${params.payload.title ?? "BloomPilot reminder"}*\n${params.payload.message}${items}`;

  const result = await sendWhatsApp(params.toNumber, body);

  if (result.sent) {
    return { status: "sent", provider_message_id: result.sid };
  }
  return {
    status: "failed",
    error_code: "whatsapp_send_failed",
    error_message: result.reason ?? "WhatsApp send failed",
  };
}
