/**
 * JCTM Temple TV — Service Worker
 *
 * Strategy:
 *  - Static assets (JS/CSS/fonts/images): Cache-first with network fallback
 *  - API requests:  Network-first with cache fallback (stale-while-revalidate)
 *  - Navigation:   Network-first with offline shell fallback
 *  - SSE streams:  Always bypass cache (real-time)
 *
 * Push Notifications: Supported for live service alerts
 */

const CACHE_VERSION = "jctm-v3";
const STATIC_CACHE  = `${CACHE_VERSION}-static`;
const API_CACHE     = `${CACHE_VERSION}-api`;

const PRECACHE_URLS = [
  "/manifest.json",
  "/favicon.svg",
  "/icon-192.png",
  "/favicon.png",
];

const NEVER_CACHE = [
  "/api/livestream/stream",
  "/api/sermons/stream",
  "/api/livechat",
];

// ─── Install ──────────────────────────────────────────────────────────────────

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch((err) => {
        console.warn("[SW] Precache failed (non-fatal):", err);
      });
    }).then(() => self.skipWaiting())
  );
});

// ─── Activate ─────────────────────────────────────────────────────────────────

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE && k !== API_CACHE)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ─── Fetch ────────────────────────────────────────────────────────────────────

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and cross-origin requests
  if (request.method !== "GET") return;
  if (url.origin !== self.location.origin) return;

  // Never cache SSE streams or real-time endpoints
  if (NEVER_CACHE.some((p) => url.pathname.startsWith(p))) return;

  // API requests: network-first, cache fallback (30s stale)
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirstWithCache(request, API_CACHE, 30));
    return;
  }

  // Static assets with hashes: cache-first forever
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Navigation requests: network-first, offline shell fallback
  if (request.mode === "navigate") {
    event.respondWith(navigationStrategy(request));
    return;
  }

  // Other static files: stale-while-revalidate
  event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
});

// ─── Strategies ───────────────────────────────────────────────────────────────

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(cacheName);
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirstWithCache(request, cacheName, maxAgeSeconds) {
  try {
    const response = await fetch(request, { signal: AbortSignal.timeout(5000) });
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) {
      const dateHeader = cached.headers.get("date");
      if (dateHeader) {
        const age = (Date.now() - new Date(dateHeader).getTime()) / 1000;
        if (age < maxAgeSeconds * 60) return cached;
      } else {
        return cached;
      }
    }
    return new Response(JSON.stringify({ error: "Offline", offline: true }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => null);
  return cached ?? (await fetchPromise) ?? new Response("", { status: 504 });
}

async function navigationStrategy(request) {
  try {
    const response = await fetch(request, { signal: AbortSignal.timeout(8000) });
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response("<html><body><h1>You are offline</h1><p>Please check your connection and try again.</p></body></html>", {
      headers: { "Content-Type": "text/html" },
    });
  }
}

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// ─── Push Notifications ───────────────────────────────────────────────────────

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "JCTM Temple TV", body: event.data.text() };
  }

  const options = {
    body: payload.body ?? "A new update is available.",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    image: payload.image ?? undefined,
    tag: payload.tag ?? "jctm-notification",
    renotify: true,
    requireInteraction: payload.requireInteraction ?? false,
    data: { url: payload.url ?? "/sermons", broadcastType: payload.data?.broadcastType ?? null },
    actions: payload.actions ?? [],
    vibrate: [200, 100, 200],
  };

  event.waitUntil(
    Promise.all([
      // Show OS-level push notification
      self.registration.showNotification(payload.title ?? "JCTM Temple TV", options),
      // Relay payload to all open page clients so in-app toast fires instantly
      self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: "BROADCAST_PUSH",
            payload: {
              title: payload.title ?? "JCTM Temple TV",
              body: payload.body ?? "",
              url: payload.url ?? "/sermons",
              broadcastType: payload.data?.broadcastType ?? null,
              tag: payload.tag ?? null,
            },
          });
        });
      }),
    ])
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url ?? "/sermons";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      // Focus and navigate the first existing window, or open a new one
      const existing = clients.find((c) => c.url.includes(self.location.origin));
      if (existing) {
        existing.focus();
        existing.navigate(targetUrl);
      } else {
        self.clients.openWindow(targetUrl);
      }
    })
  );
});
