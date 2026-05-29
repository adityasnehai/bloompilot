import { Resend } from "resend";
import type {
  ReminderSendPayload,
  ReminderSendResult,
} from "@/lib/notifications/types";

const resendKey = process.env.RESEND_API_KEY?.trim();
const fromEmail = process.env.RESEND_FROM_EMAIL?.trim();
const resend = resendKey ? new Resend(resendKey) : null;

function toHtml(payload: ReminderSendPayload) {
  const list = payload.items.map((item) => `<li>${item}</li>`).join("");
  return `
    <h2>${payload.title}</h2>
    <p>${payload.message}</p>
    <ul>${list}</ul>
  `;
}

export async function sendEmailReminder(params: {
  to: string;
  payload: ReminderSendPayload;
}): Promise<ReminderSendResult> {
  if (!resend || !fromEmail) {
    return {
      status: "failed",
      error_code: "email_provider_not_configured",
      error_message: "RESEND_API_KEY or RESEND_FROM_EMAIL is missing.",
    };
  }

  try {
    const response = await resend.emails.send({
      from: fromEmail,
      to: [params.to],
      subject: params.payload.subject,
      text: `${params.payload.message}\n\n${params.payload.items.join("\n")}`,
      html: toHtml(params.payload),
    });

    return {
      status: "sent",
      provider_message_id: response.data?.id,
    };
  } catch (error) {
    return {
      status: "failed",
      error_code: "email_send_failed",
      error_message:
        error instanceof Error ? error.message : "Unknown email send failure",
    };
  }
}
