import assert from "node:assert/strict";
import { test } from "node:test";
import { databaseKey, loadVerifiedDatabase } from "../database-cache.js";

const dataset = { id: "gtnh-2.8.0", label: "GTNH 2.8.0", uncompressedSha256: "a".repeat(64), dataUrl: "data/data.bin" };
function setup(initial) {
  let stored = initial, downloads = 0, writes = 0, deletes = 0;
  const cache = { get: async key => { assert.equal(key, databaseKey(dataset)); return stored; },
    put: async (version, buffer) => { assert.equal(version, dataset); stored = buffer; writes++; },
    remove: async () => { stored = undefined; deletes++; } };
  const download = async (progress, url) => { assert.equal(url, dataset.dataUrl); downloads++; return "verified"; };
  const verify = async buffer => { if (buffer !== "verified") throw new Error("Checksum mismatch"); };
  return { cache, download, verify, counts: () => ({ downloads, writes, deletes }) };
}
test("a verified cached database skips both network and gzip decompression", async () => {
  const options = setup("verified");
  assert.deepEqual(await loadVerifiedDatabase(dataset, undefined, options), { buffer: "verified", source: "cache", saved: true });
  assert.deepEqual(options.counts(), { downloads: 0, writes: 0, deletes: 0 });
});
test("a corrupted cache is evicted and replaced by a verified download", async () => {
  const options = setup("damaged");
  assert.equal((await loadVerifiedDatabase(dataset, undefined, options)).source, "network");
  assert.deepEqual(options.counts(), { downloads: 1, writes: 1, deletes: 1 });
});
test("cache keys include both exact pack identity and content hash", () => {
  assert.notEqual(databaseKey(dataset), databaseKey({ ...dataset, id: "gtnh-2.9.0" }));
  assert.notEqual(databaseKey(dataset), databaseKey({ ...dataset, uncompressedSha256: "b".repeat(64) }));
});
test("quota failures and unavailable storage leave recipes usable", async () => {
  const options = setup();
  options.cache.get = options.cache.put = async () => { throw new Error("Quota exceeded"); };
  const result = await loadVerifiedDatabase(dataset, undefined, options);
  assert.equal(result.buffer, "verified"); assert.equal(result.saved, false);
});
test("an invalid download is never saved or published", async () => {
  const options = setup(); options.download = async () => "wrong version";
  await assert.rejects(loadVerifiedDatabase(dataset, undefined, options), /Checksum mismatch/);
  assert.equal(options.counts().writes, 0);
});
test("aborted comparisons do not start downloads or mutate cached data", async () => {
  const controller = new AbortController(), options = setup(); controller.abort();
  await assert.rejects(loadVerifiedDatabase(dataset, undefined, { ...options, signal: controller.signal }), { name: "AbortError" });
  assert.deepEqual(options.counts(), { downloads: 0, writes: 0, deletes: 0 });
});
