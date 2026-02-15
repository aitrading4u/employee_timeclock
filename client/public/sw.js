const CACHE_NAME = "timeclock-v2";
const PRECACHE_URLS = ["/", "/index.html", "/manifest.webmanifest", "/icon.svg"];

self.addEventListener("install", event => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys =>
        Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);

  // Never cache API calls.
  if (url.origin === self.location.origin && url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Navigation requests: network-first so new deploys are picked up immediately.
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
          return response;
        })
        .catch(() =>
          caches.match(event.request).then(cached => cached || caches.match("/index.html"))
        )
    );
    return;
  }

  // Static assets: stale-while-revalidate.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request).then(cachedResponse => {
        const fetchPromise = fetch(event.request)
          .then(response => {
            if (response && response.status === 200) {
              const responseClone = response.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
            }
            return response;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  event.respondWith(fetch(event.request));
});

// Push notification event listener
self.addEventListener("push", event => {
  const data = event.data?.json() || {};
  const title = data.title || "TimeClock";
  const options = {
    body: data.body || "Tienes una notificación",
    icon: "/icon.svg",
    badge: "/icon.svg",
    tag: data.tag || "timeclock-notification",
    requireInteraction: false,
    data: data.data || {},
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Notification click event listener
self.addEventListener("notificationclick", event => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(clientList => {
      // If a window is already open, focus it
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          return client.focus();
        }
      }
      // Otherwise, open a new window
      if (clients.openWindow) {
        const url = event.notification.data?.url || "/";
        return clients.openWindow(url);
      }
    })
  );
});
