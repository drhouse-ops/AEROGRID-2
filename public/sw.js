/* AEROGRID Progressive Web App service worker.
 * - Precaches the app shell for offline loading.
 * - Queues failed citizen-report submissions (POST to the analyze/fusion endpoints)
 *   in IndexedDB and flushes them when connectivity returns.
 * - Does NOT cache API GETs (always network-first) to keep live data fresh.
 */
const CACHE = "aerogrid-shell-v1";
const SHELL = ["/", "/index.html", "/manifest.webmanifest", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network-first for navigation + shell; offline fallback to cached shell.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") {
    // Queue mutable report submissions when offline.
    if (isReportEndpoint(req.url) && !navigator.onLine) {
      event.respondWith(queueReport(req.clone()));
    }
    return;
  }

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => caches.match("/index.html").then((r) => r || Response.error()))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) =>
      cached || fetch(req).then((res) => {
        if (res.ok && isShellAsset(req.url)) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => cached || Response.error())
    )
  );
});

function isShellAsset(url) {
  return SHELL.some((s) => url.endsWith(s));
}

function isReportEndpoint(url) {
  return url.includes("/api/v1/reports/analyze") || url.includes("/api/v1/fusion/evaluate");
}

// --- Offline report queue (IndexedDB) ---
const DB_NAME = "aerogrid_offline";
const STORE = "report_queue";

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { autoIncrement: true });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function queueReport(req) {
  try {
    const db = await openDB();
    const body = await req.text();
    await new Promise((res, rej) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).add({ url: req.url, body, method: req.method, ts: Date.now() });
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  } catch (e) {
    console.warn("[sw] failed to queue offline report", e);
  }
  return new Response(JSON.stringify({ success: false, queuedOffline: true }), {
    status: 202,
    headers: { "Content-Type": "application/json" },
  });
}

// Flush queued reports when back online.
self.addEventListener("message", (event) => {
  if (event.data === "FLUSH_OFFLINE") flushQueue();
});

async function flushQueue() {
  try {
    const db = await openDB();
    const items = await new Promise((res, rej) => {
      const tx = db.transaction(STORE, "readonly");
      const r = tx.objectStore(STORE).getAll();
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    for (const item of items) {
      try {
        await fetch(item.url, { method: item.method, headers: { "Content-Type": "application/json" }, body: item.body });
        await new Promise((res, rej) => {
          const tx = db.transaction(STORE, "readwrite");
          tx.objectStore(STORE).delete(item.id);
          tx.oncomplete = () => res();
          tx.onerror = () => rej(tx.error);
        });
      } catch (e) {
        console.warn("[sw] flush failed for queued report", e);
      }
    }
  } catch (e) {
    console.warn("[sw] flushQueue error", e);
  }
}
