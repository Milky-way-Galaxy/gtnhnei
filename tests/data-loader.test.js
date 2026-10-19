import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import { test } from "node:test";
import { fetchDatabase } from "../data-loader.js";
import { Repository, Item, Fluid, Recipe, RecipeIoType } from "../dist/repository.js";
import { SearchQuery } from "../dist/searchQuery.js";

const compressed = readFileSync(new URL("../data/data.bin", import.meta.url));
const bytes = gunzipSync(compressed);
const repo = Repository.load(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));

// These also restore the runnable repository assertions from dist/tests, whose
// original Jest config, TS sources, solver fixtures and snapshots are absent.
test("the shipped database retains all items, fluids, and recipes", () => {
  assert.equal(repo.items.length, 41091);
  assert.equal(repo.fluids.length, 1542);
  assert.equal(repo.recipes.length, 190080);
  assert.equal(repo.GetById("i:gregtech:gt.blockmachines:1000").name, "Electric Blast Furnace");
  assert.equal(repo.GetById("f:IC2:ic2steam").name, "Steam");
});

test("production and usage pointers resolve with their goods and recipe dimensions", () => {
  const furnace = repo.GetById("i:gregtech:gt.blockmachines:1000");
  assert.equal(furnace.production.length, 3);
  assert.equal(furnace.consumption.length, 4);
  const steam = repo.GetById("f:IC2:ic2steam");
  assert.equal(steam.production.length, 1);
  assert.equal(steam.consumption.length, 34);
  for (const good of [furnace, steam]) {
    for (const pointer of [...good.production, ...good.consumption]) {
      const recipe = repo.GetObject(pointer, Recipe);
      assert.equal(repo.GetById(recipe.id), recipe);
      assert.ok(recipe.recipeType.name);
      assert.equal(recipe.recipeType.dimensions.length, 8);
      assert.ok(recipe.items.every(io => io.goods && io.amount >= 0));
    }
    assert.ok([...good.production].some(pointer => repo.GetObject(pointer, Recipe).items.some(io =>
      io.goods === good && [RecipeIoType.ItemOutput, RecipeIoType.FluidOutput].includes(io.type))));
  }
});

test("search still supports multiple words and mod filters across items and fluids", () => {
  const query = new SearchQuery("dust @greg");
  const goods = [...repo.items].map(ptr => repo.GetObject(ptr, Item))
    .concat([...repo.fluids].map(ptr => repo.GetObject(ptr, Fluid)));
  const matches = goods.filter(obj => repo.IsObjectMatchingSearch(obj, query));
  assert.ok(matches.length > 420);
  assert.ok(matches.every(obj => obj.mod.toLowerCase().includes("greg")));
  assert.ok(matches.every(obj => `${obj.name} ${obj.tooltip}`.toLowerCase().includes("dust")));
});

test("streamed gzip loading preserves the complete real database and reports byte progress", async t => {
  const updates = [];
  t.mock.method(globalThis, "fetch", async url => {
    assert.equal(url, "data/data.bin", "URL must stay relative for GitHub Pages");
    return new Response(compressed, { headers: { "content-length": String(compressed.length) } });
  });
  const result = await fetchDatabase(progress => updates.push(progress));
  assert.deepEqual(new Uint8Array(result), new Uint8Array(bytes));
  assert.deepEqual(updates.at(-1), { received: compressed.length, total: compressed.length });
});

test("streams without Content-Length still load and report received bytes", async t => {
  const content = gzipSync(new Uint8Array(32));
  const updates = [];
  t.mock.method(globalThis, "fetch", async () => new Response(new ReadableStream({
    start(controller) { controller.enqueue(content); controller.close(); }
  })));
  assert.equal((await fetchDatabase(progress => updates.push(progress))).byteLength, 32);
  assert.deepEqual(updates.at(-1), { received: content.length, total: 0 });
});

test("network failures identify the connection problem", async t => {
  t.mock.method(globalThis, "fetch", async () => { throw new TypeError("Failed to fetch"); });
  await assert.rejects(fetchDatabase(), /Check your connection and retry/);
});

test("HTTP errors include the status and can be retried", async t => {
  t.mock.method(globalThis, "fetch", async () => new Response("missing", { status: 404 }));
  await assert.rejects(fetchDatabase(), /HTTP 404/);
});

test("corrupt and truncated gzip downloads produce an actionable error", async t => {
  for (const body of [new Uint8Array([1, 2, 3]), compressed.subarray(0, 100)]) {
    t.mock.method(globalThis, "fetch", async () => new Response(body));
    await assert.rejects(fetchDatabase(), /incomplete or damaged/);
    t.mock.restoreAll();
  }
});

test("invalid decompressed lengths are rejected before Repository.load", async t => {
  t.mock.method(globalThis, "fetch", async () => new Response(gzipSync(new Uint8Array(33))));
  await assert.rejects(fetchDatabase(), /incomplete or damaged/);
});
