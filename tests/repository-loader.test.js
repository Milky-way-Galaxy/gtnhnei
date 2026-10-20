import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { Repository } from "../dist/repository.js";
import { loadRepository } from "../repository-loader.js";
const bytes = gunzipSync(readFileSync(new URL("../data/data.bin", import.meta.url)));
const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length);
test("cooperative loading preserves every ID offset and remap in the shipped parser", async () => {
  const original = Repository.load(buffer);
  let yields = 0;
  const progress = [];
  const responsive = await loadRepository(buffer, { yieldControl: async () => { yields++; }, onProgress: value => progress.push(value) });
  assert.ok(yields > 40);
  assert.equal(progress.at(-1).completed, progress.at(-1).total);
  assert.deepEqual(responsive.objectPositionMap, original.objectPositionMap);
  assert.equal(Repository.current, responsive);
  assert.equal(responsive.GetById("i:minecraft:iron_ingot:0").name, "Iron Ingot");
});
test("cancelled indexing does not publish an incomplete repository", async () => {
  const before = Repository.current;
  const controller = new AbortController(); controller.abort();
  await assert.rejects(loadRepository(buffer, { signal: controller.signal }), /abort/i);
  assert.equal(Repository.current, before);
});
