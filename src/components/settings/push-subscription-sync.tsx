"use client";

import { useEffect } from "react";

export function PushSubscriptionSync() {
  useEffect(() => {
    if (
      !("Notification" in window) ||
      Notification.permission !== "granted" ||
      !("serviceWorker" in navigator)
    ) {
      return;
    }

    let active = true;
    void (async () => {
      await navigator.serviceWorker.register("/push-sw.js");
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (!active || !subscription) return;

      const json = subscription.toJSON();
      if (!json.keys?.p256dh || !json.keys?.auth) return;

      await fetch("/api/notifications/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          keys: {
            p256dh: json.keys.p256dh,
            auth: json.keys.auth,
          },
        }),
      });
    })().catch(() => {
      // Settings provides the visible error state when explicit setup is needed.
    });

    return () => {
      active = false;
    };
  }, []);

  return null;
}
