export type ReminderChannel = "email" | "push" | "whatsapp";

export type ReminderSendPayload = {
  subject: string;
  title: string;
  message: string;
  items: string[];
};

export type ReminderSendResult = {
  status: "sent" | "queued" | "failed";
  provider_message_id?: string;
  error_code?: string;
  error_message?: string;
};
