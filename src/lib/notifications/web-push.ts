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

type WebPushError = {
  statusCode?: number;
  response?: {
    statusCode?: number;
  };
};

async function withTimeout<T>(promise: Promise<T>, milliseconds: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Push provider timed out.")), milliseconds);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

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

  if (
    !params.subscription.endpoint ||
    !params.subscription.p256dh ||
    !params.subscription.auth
  ) {
    return {
      status: "failed",
      error_code: "push_subscription_invalid",
      error_message: "The browser push subscription is missing required keys.",
    };
  }

  try {
    const response = await withTimeout(webpush.sendNotification(
      {
        endpoint: params.subscription.endpoint,
        keys: {
          p256dh: params.subscription.p256dh,
          auth: params.subscription.auth,
        },
      },
      JSON.stringify(params.payload),
    ), 10_000);

    return {
      status: "sent",
      provider_message_id: response.headers?.["x-message-id"] ?? undefined,
    };
  } catch (error) {
    const providerError = error as WebPushError;
    const statusCode = providerError.statusCode ?? providerError.response?.statusCode;

    return {
      status: "failed",
      error_code:
        statusCode === 404 || statusCode === 410
          ? "push_subscription_expired"
          : statusCode
            ? "push_provider_rejected"
            : "push_send_failed",
      error_message:
        statusCode
          ? `Web push provider rejected the subscription (HTTP ${statusCode}).`
          : error instanceof Error
            ? error.message
            : "Unknown push send failure",
    };
  }
}
