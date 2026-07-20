"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type SubscriptionState = "unsupported" | "idle" | "subscribed" | "error";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replaceAll("-", "+").replaceAll("_", "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }

  return outputArray;
}

async function savePushSubscription(subscription: PushSubscription) {
  const json = subscription.toJSON();
  if (!json.keys?.p256dh || !json.keys?.auth) {
    throw new Error("Push subscription keys are missing. Retry in a fresh tab.");
  }

  const response = await fetch("/api/notifications/push/subscribe", {
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

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;
    throw new Error(payload?.error || "Failed to save push subscription.");
  }
}

export function PushSubscriptionCard() {
  const [state, setState] = useState<SubscriptionState>("idle");
  const [message, setMessage] = useState<string>("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("Notification" in window) ||
      !("serviceWorker" in navigator)
    ) {
      setState("unsupported");
      setMessage("This browser does not support web push notifications.");
      return;
    }

    let active = true;
    void (async () => {
      await navigator.serviceWorker.register("/push-sw.js");
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      if (!active) return;
      if (existing) {
        await savePushSubscription(existing);
        if (!active) return;
        setState("subscribed");
        setMessage("Push notifications are active for this browser.");
      } else {
        setState("idle");
        setMessage("Push notifications are not enabled yet.");
      }
    })().catch((error: unknown) => {
      if (!active) return;
      setState("error");
      setMessage(error instanceof Error ? error.message : "Failed to initialize push.");
    });

    return () => {
      active = false;
    };
  }, []);

  async function enablePush() {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const vapidPublicKey = process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY?.trim();
      if (!vapidPublicKey) {
        throw new Error("Missing NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY.");
      }

      const currentPermission = Notification.permission;
      if (currentPermission === "denied") {
        throw new Error(
          "Notifications are blocked in browser settings for this site. Allow notifications and retry.",
        );
      }

      const permission =
        currentPermission === "granted"
          ? "granted"
          : await Notification.requestPermission();
      if (permission !== "granted") {
        throw new Error(
          "Notification permission was not granted. Please allow it in the browser prompt and retry.",
        );
      }

      await navigator.serviceWorker.register("/push-sw.js");
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        }));

      await savePushSubscription(subscription);

      setState("subscribed");
      setMessage("Push notifications are enabled.");
    } catch (error) {
      setState("error");
      setMessage(
        error instanceof Error ? error.message : "Failed to enable push notifications.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function disablePush() {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      await navigator.serviceWorker.register("/push-sw.js");
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        setState("idle");
        setMessage("Push notifications were already disabled.");
        return;
      }

      await fetch("/api/notifications/push/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });
      await subscription.unsubscribe();

      setState("idle");
      setMessage("Push notifications are disabled.");
    } catch (error) {
      setState("error");
      setMessage(
        error instanceof Error ? error.message : "Failed to disable push notifications.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="px-4 py-4">
      <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-muted)]">Web push</p>
      <p className="mt-2 text-sm leading-6 text-[var(--color-ink)]">
        Enable browser notifications for urgent care actions on this device.
      </p>
      <p className="mt-2 text-xs leading-5 text-[var(--color-muted)]">
        Status: {state === "subscribed" ? "ready" : state === "unsupported" ? "unsupported" : state === "error" ? "needs attention" : "not enabled"}
      </p>
      <p className="mt-2 text-sm text-[var(--color-muted)]">{message}</p>
      <div className="mt-4 flex gap-2">
        <Button
          type="button"
          onClick={enablePush}
          disabled={busy || state === "unsupported"}
          className="rounded-full"
        >
          Enable push
        </Button>
        <Button
          type="button"
          onClick={disablePush}
          disabled={busy || state === "unsupported"}
          variant="outline"
          className="rounded-full"
        >
          Disable push
        </Button>
      </div>
    </Card>
  );
}
