import webpush from "web-push";
import type {
  ReminderSendPayload,
  ReminderSendResult,
} from "@/lib/notifications/types";

const vapidPublicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY?.trim();
const vapidPrivateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY?.trim();
const contactEmail = process.env.WEB_PUSH_CONTACT_EMAIL?.trim();

if (vapidPublicKey && vapidPrivateKey && contactEmail) {
  webpush.setVapidDetails(
    `mailto:${contactEmail}`,
    vapidPublicKey,
    vapidPrivateKey,
  );
}

export type PushSubscriptionRecord = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

export async function sendWebPushReminder(params: {
  subscription: PushSubscriptionRecord;
  payload: ReminderSendPayload;
}): Promise<ReminderSendResult> {
  if (!vapidPublicKey || !vapidPrivateKey || !contactEmail) {
    return {
      status: "failed",
      error_code: "push_provider_not_configured",
      error_message: "VAPID keys/contact email are missing.",
    };
  }

  try {
    const response = await webpush.sendNotification(
      {
        endpoint: params.subscription.endpoint,
        keys: {
          p256dh: params.subscription.p256dh,
          auth: params.subscription.auth,
        },
      },
      JSON.stringify(params.payload),
    );

    return {
      status: "sent",
      provider_message_id: response.headers?.["x-message-id"] ?? undefined,
    };
  } catch (error) {
    return {
      status: "failed",
      error_code: "push_send_failed",
      error_message:
        error instanceof Error ? error.message : "Unknown push send failure",
    };
  }
}
