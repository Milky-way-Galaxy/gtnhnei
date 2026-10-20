import { databaseCache, databaseKey, loadVerifiedDatabase } from "./database-cache.js";
import { ICON_CACHE, SHELL_PREFIX, iconCacheKey } from "./offline-paths.js";
const base = new URL("./", import.meta.url);
export async function offlineStatus(dataset) {
  const registration = await navigator.serviceWorker?.getRegistration(base.href);
  const entries = await databaseCache.list().catch(() => []);
  const recipes = entries.find(entry => entry.key === databaseKey(dataset));
  const icons = globalThis.caches ? !!await (await caches.open(ICON_CACHE)).match(iconCacheKey(dataset, base)) : false;
  return { app: !!registration?.active, update: !!registration?.waiting, recipes, icons };
}
async function register() {
  if (!navigator.serviceWorker || !globalThis.caches) throw new Error("Offline mode needs a current browser and a secure connection.");
  const registration = await navigator.serviceWorker.register(new URL("service-worker.js", base), { scope: base.pathname, type: "module", updateViaCache: "none" });
  if (registration.active?.state === "activated") return registration;
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("The offline app could not finish installing. Check your connection and retry.")), 60000);
    function changed() {
      if (registration.active?.state === "activated") { clearTimeout(timeout); resolve(); }
      else if (worker?.state === "redundant") { clearTimeout(timeout); reject(new Error("Offline app installation failed. Retry while online.")); }
    }
    const worker = registration.installing || registration.waiting || registration.active;
    worker?.addEventListener("statechange", changed); changed();
  });
  return registration;
}
export async function saveOffline(dataset, onStatus = () => {}) {
  onStatus("Saving the application for offline use…");
  await register();
  await loadVerifiedDatabase(dataset, undefined, { onStatus: (phase, text) => onStatus(text) });
  onStatus(`Saving and verifying ${dataset.label} icons. This may take a moment…`);
  const response = await fetch(new URL(dataset.atlasUrl, base), { cache: "reload" });
  if (!response.ok) throw new Error(`Icons could not download (HTTP ${response.status}).`);
  const buffer = await response.arrayBuffer();
  const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", buffer))].map(value => value.toString(16).padStart(2, "0")).join("");
  if (hash !== dataset.atlasSha256) throw new Error("Icon checksum differs from this dataset. No offline icons were saved.");
  await (await caches.open(ICON_CACHE)).put(iconCacheKey(dataset, base), new Response(buffer, { headers: { "Content-Type": "image/webp" } }));
  const status = await offlineStatus(dataset);
  if (!status.recipes || !status.icons) throw new Error("Browser storage could not retain the complete version. Free storage and retry.");
  return status;
}
export async function removeOfflineDataset(dataset) {
  await databaseCache.remove(databaseKey(dataset));
  if (globalThis.caches) await (await caches.open(ICON_CACHE)).delete(iconCacheKey(dataset, base));
}
export async function disableOffline() {
  const registration = await navigator.serviceWorker?.getRegistration(base.href);
  await registration?.unregister();
  if (globalThis.caches) for (const name of await caches.keys()) if (name.startsWith(SHELL_PREFIX) || name === ICON_CACHE) await caches.delete(name);
}
export async function applyOfflineUpdate() {
  const registration = await navigator.serviceWorker?.getRegistration(base.href);
  if (!registration?.waiting) return false;
  navigator.serviceWorker.addEventListener("controllerchange", () => location.reload(), { once: true });
  registration.waiting.postMessage("activate-update"); return true;
}
export async function checkOfflineUpdate(callback) {
  const registration = await navigator.serviceWorker?.getRegistration(base.href);
  if (!registration) return;
  const changed = () => { if (registration.waiting) callback(); };
  registration.addEventListener("updatefound", () => registration.installing?.addEventListener("statechange", changed));
  changed();
  try { await registration.update(); } catch { /* An offline browser keeps its installed build. */ }
}
