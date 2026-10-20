import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSupplyPlan, packingFor, supplyCsv } from "../supply-plan.js";
import { normalizePlannerState, serializePlan, importPlan } from "../planner-state.js";
const plan = { dataset: { id: "test", sha256: "a" }, isRate: true, knownAverageEut: 48, knownEnergy: 38400,
  hasUnknownPower: false, unresolved: [], capacityAnalysis: { rateFactor: .625, partial: false },
  targets: [{ id: "f:product", name: "Product", requested: 50, unit: "L" }],
  materials: [{ id: "f:feed", name: "Fluid", amount: 100, unit: "L" }, { id: "i:dust", name: "Dust", amount: .15, unit: "items" }],
  reusable: [{ id: "i:circuit", name: "Circuit", amount: 2, unit: "items" }], byproducts: [] };
const catalog = { resolve: id => ({ id, type: id.startsWith("f:") ? "fluid" : "item", stackSize: id === "i:circuit" ? 1 : 16 }), describe: good => good };
test("a two-hour run integrates rate inputs, output and EU with 20 ticks/second", () => {
  const supply = buildSupplyPlan(plan, { seconds: 7200 }, catalog);
  assert.equal(supply.consumption[0].amount, 720000); assert.equal(supply.consumption[0].packing.buckets, 720);
  assert.equal(supply.consumption[1].amount, 1080); assert.deepEqual(supply.consumption[1].packing, { stackSize: 16, stacks: 67, remainder: 8 });
  assert.equal(supply.outputs[0].amount, 360000); assert.equal(supply.knownEnergy, 6912000);
  assert.equal(supply.startup[0].amount, 2, "startup stock is not multiplied by run duration");
});
test("installed-capacity projection scales the entire mix and flags partial limits", () => {
  const supply = buildSupplyPlan({ ...plan, capacityAnalysis: { rateFactor: .625, partial: true } }, { seconds: 7200, basis: "installed" }, catalog);
  assert.equal(supply.outputs[0].amount, 225000); assert.equal(supply.knownEnergy, 4320000);
  assert.equal(supply.consumption[0].amount, 450000); assert.equal(supply.capacityPartial, true);
});
test("total crafts use the exact computed quantities rather than multiplying again", () => {
  const supply = buildSupplyPlan({ ...plan, isRate: false }, { seconds: 7200, basis: "installed" }, catalog);
  assert.equal(supply.consumption[0].amount, 100); assert.equal(supply.knownEnergy, 38400); assert.equal(supply.seconds, null);
});
test("checks apply only to the exact current quantity and never change demand", () => {
  const supply = buildSupplyPlan(plan, { seconds: 10, checks: { "input:f:feed": 1000, "startup:i:circuit": 2 } }, catalog);
  assert.equal(supply.completed, 2); assert.equal(supply.consumption[0].amount, 1000);
  assert.equal(buildSupplyPlan(plan, { seconds: 20, checks: { "input:f:feed": 1000 } }, catalog).completed, 0);
});
test("unknown timing, invalid horizons and numeric overflow cannot invent supplies", () => {
  assert.throws(() => buildSupplyPlan({ ...plan, capacityAnalysis: {} }, { basis: "installed" }), /unknown/);
  for (const seconds of [0, -1, NaN, Infinity, 31536001]) assert.throws(() => buildSupplyPlan(plan, { seconds }), /duration/);
  assert.throws(() => buildSupplyPlan({ ...plan, knownAverageEut: Number.MAX_VALUE }, { seconds: 7200 }), /numeric range/);
});
test("packing uses actual stack sizes and keeps fractional amounts unrounded", () => {
  assert.deepEqual(packingFor(19.5, { stackSize: 16 }), { stackSize: 16, stacks: 1, remainder: 3.5 });
  assert.deepEqual(packingFor(144, { type: "fluid" }), { buckets: .144 });
  assert.equal(packingFor(1, { stackSize: 0 }), null);
});
test("CSV preserves exact IDs, units and quoted material names", () => {
  const supply = buildSupplyPlan(plan, { seconds: 7200 }, catalog);
  supply.consumption[0].name = 'Fluid, "test"';
  const text = supplyCsv(supply); assert.match(text, /"Fluid, ""test"""/); assert.match(text, /"720000","L"/); assert.match(text, /"f:feed"/);
});
test("supply preferences and preparation survive portable plans without changing numeric model format", () => {
  const dataset = { id: "gtnh-2.8.0", sha256: "a".repeat(64) };
  const settings = normalizePlannerState({ target: "f:feed", amount: 1, operatingSeconds: 7200, operatingBasis: "installed", checklist: { "input:f:feed": 450000 } });
  const text = serializePlan(settings, dataset);
  assert.equal(JSON.parse(text).schemaVersion, 1); assert.deepEqual(importPlan(text, dataset), settings);
  for (const checklist of [{ "input:f:feed": -1 }, { "input:f:feed": Infinity }, { "wrong": 3 }, []]) assert.throws(() => normalizePlannerState({ amount: 1, checklist }), /checklist/);
  assert.equal(normalizePlannerState({ amount: 1 }).operatingSeconds, 3600);
});
