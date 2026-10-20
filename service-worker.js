import { BUILD_ID, SHELL_FILES, ATLASES } from "./offline-manifest.js";
import { ICON_CACHE, SHELL_PREFIX, iconCacheKey } from "./offline-paths.js";
const root = new URL("./", self.location.href);
const shellName = SHELL_PREFIX + BUILD_ID;
const shellURLs = new Set(SHELL_FILES.map(path => new URL(path, root).href));
const icons = new Map(ATLASES.map(dataset => [new URL(dataset.atlasUrl, root).pathname, iconCacheKey(dataset, root)]));

self.addEventListener("install", event => {
  // An incomplete shell never activates. The previous application remains usable
  // until every file of this build has arrived and the player accepts an update.
  event.waitUntil(caches.open(shellName).then(cache => cache.addAll(SHELL_FILES.map(path => new Request(new URL(path, root), { cache: "reload" })))));
});
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) if (name.startsWith(SHELL_PREFIX) && name !== shellName) await caches.delete(name);
    await self.clients.claim();
  })());
});
self.addEventListener("message", event => { if (event.data === "activate-update") self.skipWaiting(); });
self.addEventListener("fetch", event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== root.origin) return;
  const normalized = new URL(url.pathname, url.origin).href;
  const navigation = request.mode === "navigate" && [root.pathname, root.pathname + "index.html"].includes(url.pathname);
  if (navigation || shellURLs.has(normalized)) {
    const key = navigation ? new URL("index.html", root).href : normalized;
    event.respondWith(caches.open(shellName).then(async cache => await cache.match(key) || fetch(request)));
  } else if (icons.has(url.pathname)) {
    event.respondWith(caches.open(ICON_CACHE).then(async cache => await cache.match(icons.get(url.pathname)) || fetch(request)));
  }
  // Recipe databases use their independent, checksum-verified IndexedDB cache.
  // Third-party Pyodide/Viz resources are deliberately not advertised as offline.
});
