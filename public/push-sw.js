self.addEventListener("push", (event) => {
  let payload = {
    title: "BloomPilot reminder",
    message: "You have a plant-care task due.",
  };

  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload = {
        title: "BloomPilot reminder",
        message: event.data.text(),
      };
    }
  }

  const title = payload.title || "BloomPilot reminder";
  const body = payload.message || "You have a plant-care task due.";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/next.svg",
      badge: "/next.svg",
      data: payload,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow("/reminders"));
});
