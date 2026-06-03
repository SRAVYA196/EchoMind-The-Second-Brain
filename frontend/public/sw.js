// sw.js — place this in your public/ folder (same level as index.html)

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

// Listen for messages from the main app to schedule a notification
self.addEventListener("message", (event) => {
  if (event.data?.type === "SCHEDULE_NOTIFICATION") {
    const { title, body, delayMs, tag } = event.data;
    // Use setTimeout inside SW to fire after delay
    setTimeout(() => {
      self.registration.showNotification(title, {
        body,
        tag,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        vibrate: [200, 100, 200],
        requireInteraction: true,
      });
    }, delayMs);
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      if (clients.length > 0) clients[0].focus();
      else self.clients.openWindow("/");
    })
  );
});