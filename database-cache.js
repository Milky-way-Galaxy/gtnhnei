// Verified, decompressed databases are disposable. Plans and favorites never
// live here, so clearing a cache cannot erase a player's work.
import { fetchDatabase } from "./data-loader.js";
import { verifyDatasetBuffer } from "./datasets.js";

export const databaseKey = dataset => `${dataset.id}:${dataset.uncompressedSha256}`;
export function createDatabaseCache(indexedDB = globalThis.indexedDB) {
  let opening;
  function open() {
    if (!indexedDB) return Promise.reject(new Error("Database storage is unavailable."));
    if (!opening) opening = new Promise((resolve, reject) => {
      const request = indexedDB.open("gtnh-atlas-recipe-cache-v1", 1);
      let expired = false;
      const timeout = setTimeout(() => { expired = true; reject(new Error("Database storage is busy.")); }, 3000);
      request.onupgradeneeded = () => {
        request.result.createObjectStore("buffers");
        request.result.createObjectStore("metadata", { keyPath: "key" });
      };
      request.onerror = () => { clearTimeout(timeout); reject(request.error); };
      request.onsuccess = () => {
        clearTimeout(timeout);
        const db = request.result;
        if (expired) { db.close(); return; }
        db.onversionchange = () => { db.close(); opening = null; };
        resolve(db);
      };
    }).catch(error => { opening = null; throw error; });
    return opening;
  }
  async function transaction(mode, callback) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(["buffers", "metadata"], mode);
      const timeout = setTimeout(() => { try { tx.abort(); } catch {} }, 8000);
      let result;
      tx.oncomplete = () => { clearTimeout(timeout); resolve(result?.result); };
      tx.onerror = tx.onabort = () => { clearTimeout(timeout); reject(tx.error || new Error("Database storage was interrupted.")); };
      result = callback(tx.objectStore("buffers"), tx.objectStore("metadata"));
    });
  }
  return {
    get: key => transaction("readonly", buffers => buffers.get(key)),
    list: () => transaction("readonly", (buffers, metadata) => metadata.getAll()),
    put: (dataset, buffer) => transaction("readwrite", (buffers, metadata) => {
      const key = databaseKey(dataset);
      buffers.put(buffer, key);
      metadata.put({ key, datasetId: dataset.id, label: dataset.label, hash: dataset.uncompressedSha256, bytes: buffer.byteLength, savedAt: Date.now() });
      // Replace obsolete revisions of this version without evicting a different
      // pack's separately verified data. The cursor never reads large buffers.
      const request = metadata.openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return;
        if (cursor.value.datasetId === dataset.id && cursor.key !== key) { buffers.delete(cursor.key); cursor.delete(); }
        cursor.continue();
      };
    }),
    remove: key => transaction("readwrite", (buffers, metadata) => { buffers.delete(key); metadata.delete(key); }),
    clear: () => transaction("readwrite", (buffers, metadata) => { buffers.clear(); metadata.clear(); })
  };
}

export const databaseCache = createDatabaseCache();

// Every cached buffer is checked against the selected manifest before parsing.
// Bad/old/full/blocked storage is recoverable and never blocks a network load.
export async function loadVerifiedDatabase(dataset, onProgress = () => {}, {
  signal, cache = databaseCache, download = fetchDatabase, verify = verifyDatasetBuffer, onStatus = () => {}
} = {}) {
  const key = databaseKey(dataset);
  signal?.throwIfAborted();
  onStatus("cache", `Checking saved ${dataset.label} data…`);
  let buffer;
  try { buffer = await cache.get(key); } catch { /* A cache is optional. */ }
  signal?.throwIfAborted();
  if (buffer) {
    try {
      onStatus("verify", `Verifying saved ${dataset.label} data…`);
      await verify(buffer, dataset);
      signal?.throwIfAborted();
      return { buffer, source: "cache", saved: true };
    } catch (error) {
      signal?.throwIfAborted();
      try { await cache.remove(key); } catch { /* Continue with a fresh download. */ }
      onStatus("fetch", "Saved data was damaged; downloading a verified copy…");
    }
  }
  onStatus("fetch", `Downloading ${dataset.label}…`);
  buffer = await download(onProgress, dataset.dataUrl, { signal });
  signal?.throwIfAborted();
  onStatus("verify", `Verifying ${dataset.label} data…`);
  await verify(buffer, dataset);
  signal?.throwIfAborted();
  let saved = false;
  try { await cache.put(dataset, buffer); saved = true; } catch { /* Quota/private browsing must not break recipes. */ }
  return { buffer, source: "network", saved };
}
