const APP_CACHE = "ustory-static-v3";
const RUNTIME_CACHE = "ustory-runtime-v3";

const IS_DEV = self.location.hostname === "localhost" || self.location.hostname === "127.0.0.1";

const STORY_API_HOST = "story-api.dicoding.dev";
const STORY_API_PREFIX = "/v1/stories";

async function networkFirst(req) {
  try {
    const net = await fetch(req);
    const c = await caches.open(RUNTIME_CACHE);
    c.put(req, net.clone());
    return net;
  } catch {
    const cached = await caches.match(req);
    if (cached) return cached;
    return new Response(JSON.stringify({ offline: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(req);
  if (cached) return cached;

  try {
    const res = await fetch(req);
    cache.put(req, res.clone());
    return res;
  } catch {
    const fallback = await caches.match("/images/logo.png");
    return fallback || new Response("", { status: 504 });
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(APP_CACHE);

      const PRECACHE_URLS = ["/", "/index.html", "/images/logo.png", "/images/favicon.png", "/manifest.webmanifest"];

      for (const url of PRECACHE_URLS) {
        try {
          const req = new Request(url, { cache: "reload" });
          const res = await fetch(req);
          if (res.ok) await cache.put(req, res);
        } catch (e) {
          console.warn("[SW] Precache skip:", url, e.message);
        }
      }

      if (!IS_DEV) await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => ![APP_CACHE, RUNTIME_CACHE].includes(k)).map((k) => caches.delete(k)));

      if (!IS_DEV) await self.clients.claim();

      console.log("[SW] Active & ready ✅");
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (req.method !== "GET") return;

  if (
    IS_DEV &&
    (url.pathname.includes("hot-update") ||
      url.pathname.includes("sockjs") ||
      url.pathname.startsWith("/__webpack") ||
      url.pathname.startsWith("/webpack") ||
      url.pathname.startsWith("/hmr") ||
      url.pathname === "/ws" ||
      (req.headers.get("accept") || "").includes("text/event-stream"))
  ) {
    return;
  }

  if (url.pathname === "/sw.js") return;

  if (req.destination === "image" && url.hostname === STORY_API_HOST) {
    event.respondWith(cacheFirst(req));
    return;
  }

  if (url.hostname === STORY_API_HOST && url.pathname.startsWith(STORY_API_PREFIX)) {
    event.respondWith(networkFirst(req));
    return;
  }

  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          return await fetch(req);
        } catch {
          const shell = await caches.match("/index.html");
          return (
            shell ||
            new Response("<h1>Offline</h1>", {
              headers: { "Content-Type": "text/html" },
              status: 200,
            })
          );
        }
      })()
    );
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(RUNTIME_CACHE);
        const cached = await cache.match(req);
        if (cached) return cached;
        try {
          const net = await fetch(req);
          cache.put(req, net.clone());
          return net;
        } catch {
          return cached || new Response("", { status: 504 });
        }
      })()
    );
  }
});

self.addEventListener("push", (event) => {
  let payload = {
    title: "UStory",
    options: { body: "Notifikasi baru dari UStory." },
  };

  try {
    if (event.data) {
      const text = event.data.text();
      try {
        const json = JSON.parse(text);
        if (json && typeof json === "object") payload = json;
      } catch {
        payload = {
          title: "UStory",
          options: { body: text || "Notifikasi baru dari UStory." },
        };
      }
    }
  } catch (e) {
    console.warn("[SW] Push payload parse fail:", e);
  }

  const opts = payload.options || {};
  const icon = opts.icon || "/images/icons/icon-192.png";
  const badge = opts.badge || "/images/icons/icon-192.png";
  const actions = opts.actions && Array.isArray(opts.actions) && opts.actions.length ? opts.actions : [{ action: "open", title: "Lihat Detail" }];

  const data = Object.assign({}, opts.data || {}, {
    url: (opts.data && opts.data.url) || "/",
  });

  const options = Object.assign(
    {
      icon,
      badge,
      actions,
      data,
      tag: opts.tag || "ustory-push",
      renotify: Boolean(opts.renotify ?? true),
    },
    opts
  );

  event.waitUntil(self.registration.showNotification(payload.title || "UStory", options));
});

self.addEventListener("notificationclick", (event) => {
  const url = event.notification?.data?.url || "/";
  event.notification.close();

  event.waitUntil(
    (async () => {
      const allClients = await clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const absolute = new URL(url, self.location.origin).href;

      const existing = allClients.find((c) => c.url === absolute);
      if (existing) {
        existing.focus();
        existing.postMessage({ type: "PUSH_CLICK", url });
        return;
      }

      const opened = await clients.openWindow(absolute);
      try {
        opened?.postMessage({ type: "PUSH_CLICK", url });
      } catch {}
    })()
  );
});

self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      const all = await clients.matchAll({ type: "window", includeUncontrolled: true });
      all.forEach((c) => c.postMessage({ type: "PUSH_SUBSCRIPTION_CHANGE" }));
    })()
  );
});
