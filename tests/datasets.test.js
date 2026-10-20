import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { validateManifest, selectDataset, verifyDatasetBuffer } from "../datasets.js";
import { normalizePlannerState, serializePlan, importPlan, defaultPlannerState } from "../planner-state.js";
const manifest = JSON.parse(readFileSync(new URL("../data/manifest.json", import.meta.url)));
const dataset = manifest.datasets[0];
test("only verified available dataset selections are accepted; 2.8.4 never falls back to 2.8.0", () => {
  assert.equal(selectDataset(validateManifest(manifest)).id, "gtnh-2.8.0");
  assert.throws(() => selectDataset(manifest, "gtnh-2.8.4"), /unavailable/);
  assert.throws(() => selectDataset(manifest, "missing"), /Unknown/);
  const duplicate = structuredClone(manifest); duplicate.datasets.push(dataset);
  assert.throws(() => validateManifest(duplicate), /Duplicate/);
});
test("the shipped binary and icon atlas match their version manifest hashes", async () => {
  for (const [file, expected] of [["data/data.bin", dataset.sha256], ["data/atlas.webp", dataset.atlasSha256]]) {
    const bytes = readFileSync(new URL("../" + file, import.meta.url));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), expected);
  }
  const bytes = gunzipSync(readFileSync(new URL("../data/data.bin", import.meta.url)));
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length);
  await verifyDatasetBuffer(buffer, dataset);
  const wrongHash = { ...dataset, uncompressedSha256: "0".repeat(64) };
  await assert.rejects(verifyDatasetBuffer(buffer, wrongHash), /checksum/);
});
test("unverified data descriptors and remote/traversal asset paths are rejected", () => {
  for (const patch of [{ sourceRevision: null }, { sha256: null }, { format: 7 }, { dataUrl: "https://example.com/data.bin" }, { atlasUrl: "../atlas.webp" }]) {
    const copy = structuredClone(manifest); Object.assign(copy.datasets[0], patch);
    assert.throws(() => validateManifest(copy));
  }
});
test("versioned plans round trip and cannot import into a different version or changed export", () => {
  const state = normalizePlannerState({ target: "Water", amount: 5, unit: "L", routeChoices: { "f:minecraft:water": "recipe-id" }, settings: { waterFree: false } });
  assert.equal(state.settings.expandCircuits, false);
  const text = serializePlan(state, dataset);
  assert.deepEqual(importPlan(text, dataset), state);
  assert.throws(() => importPlan(text, { ...dataset, id: "gtnh-2.8.4" }), /different recipe dataset/);
  assert.throws(() => importPlan(text, { ...dataset, sha256: "other" }), /different recipe dataset/);
});
test("legacy settings preserve user preferences and partial nested settings", () => {
  const state = importPlan(JSON.stringify({ target: "Iron Ingot", amount: 64, settings: { waterFree: false }, lockedRoutes: { "iron ingot": 4 } }), dataset);
  assert.equal(state.settings.waterFree, false);
  assert.equal(state.settings.cellsReusable, true);
  assert.equal(state.lockedRoutes["iron ingot"], 4);
});
test("invalid or oversized imports fail without mutating active settings", () => {
  const before = structuredClone(defaultPlannerState);
  for (const raw of ["not json", JSON.stringify({ amount: -5 }), JSON.stringify({ routeMode: "invented" }), "x".repeat(2000001)]) assert.throws(() => importPlan(raw, dataset));
  assert.deepEqual(defaultPlannerState, before);
});
test("identity-free legacy plans cannot silently move into a different GTNH version", () => {
  assert.throws(()=>importPlan(JSON.stringify({target:"Iron Ingot",amount:1}),{id:"gtnh-2.8.4"}), /no dataset identity/);
});
test("finite inventory survives portable plans and rejects malformed quantities without mutation", () => {
  const raw = { inventory: { "i:minecraft:iron_ingot:0": "64", "f:gregtech:liquid_epichlorhydrin": 1000 } };
  const state = normalizePlannerState(raw);
  assert.equal(raw.inventory["i:minecraft:iron_ingot:0"], "64");
  assert.deepEqual(importPlan(serializePlan(state, dataset), dataset).inventory, state.inventory);
  for (const inventory of [[], { "Water": 3 }, { "f:water": -1 }, { "f:water": Infinity }, JSON.parse('{"__proto__":1}')]) {
    assert.throws(() => normalizePlannerState({ inventory }), /[Ii]nventory/);
  }
});
test("factory plan format 2 preserves output units and counts while legacy format 1 stays supported", () => {
  const state=normalizePlannerState({target:"Water",unit:"L",additionalTargets:[{target:"i:minecraft:bucket:0",amount:2,unit:"stacks",machineCount:3}]});
  const text=serializePlan(state,dataset); assert.equal(JSON.parse(text).schemaVersion,2);
  assert.deepEqual(importPlan(text,dataset),state);
  assert.equal(JSON.parse(serializePlan(defaultPlannerState,dataset)).schemaVersion,1);
  for(const additionalTargets of [[null],[{target:"Water",amount:0,unit:"L"}],Array(20).fill({target:"Water",amount:1,unit:"L"})]) assert.throws(()=>normalizePlannerState({additionalTargets}));
});
