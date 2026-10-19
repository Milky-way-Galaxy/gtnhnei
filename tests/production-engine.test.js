import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { Repository } from "../dist/repository.js";
import { RecipeCatalog } from "../recipe-data.js";
import { exportRecipeYaml, exportPlanYaml } from "../recipe-export.js";
import { calculateProduction, machinePerformance } from "../production-engine.js";

const good = (id, type = "item") => ({ id, name: id, type, unit: type === "fluid" ? "L" : "items", amount: 1, probability: 1 });
const io = (id, amount, probability = 1) => ({ ...good(id), amount, probability });
const recipe = (id, inputs, outputs, extra = {}) => ({ id, machine: id, inputs, outputs, durationTicks: 200, eut: 30, voltage: 30, amperage: 1, ...extra });
function fixture(records, goods = []) {
  const all = new Map(goods.map(g => [g.id, g]));
  for (const r of records) for (const g of [...r.inputs, ...r.outputs]) all.set(g.id, g);
  return { dataset: { id: "test" }, resolve: id => all.get(id), describe: g => ({ ...g }),
    recipes: g => records.filter(r => r.outputs.some(io => io.id === g.id)), matches: () => [] };
}
const options = { target: "product", amount: 1, depth: "full", routeMode: "lowest_tier" };
test("recursive quantities aggregate shared raw resources and round whole crafts", () => {
  const catalog = fixture([recipe("a", [io("part", 3)], [io("product", 2)]), recipe("b", [io("raw", 2)], [io("part", 2)])]);
  const result = calculateProduction(catalog, { ...options, amount: 5 });
  assert.equal(result.root.batches, 3);
  assert.equal(result.materials[0].amount, 10);
  assert.equal(result.byproducts.find(row => row.id === "product").amount, 1);
  assert.equal(result.byproducts.find(row => row.id === "part").amount, 1);
});
test("continuous rates use fractional batches, machine counts, average and installed EU/t", () => {
  const catalog = fixture([recipe("a", [io("raw", 3)], [io("product", 2)])]);
  const result = calculateProduction(catalog, { ...options, amount: 18, rateMode: "per_minute" });
  assert.equal(result.requested, .3);
  assert.equal(result.steps[0].batches, .15);
  assert.equal(result.steps[0].count, 2);
  assert.ok(Math.abs(result.knownAverageEut - 45) < 1e-10);
  assert.equal(result.knownInstalledEut, 60);
  assert.ok(Math.abs(result.materials[0].amount - .45) < 1e-12);
});
test("expected chance output is applied without claiming guaranteed production", () => {
  const result = calculateProduction(fixture([recipe("a", [io("raw", 1)], [io("product", 1, .25)])]), options);
  assert.equal(result.root.batches, 4);
  assert.equal(result.materials[0].amount, 4);
  assert.match(result.warnings.join(" "), /not guaranteed/);
});
test("cycles are stopped by identity even when each iteration changes the amount", () => {
  const result = calculateProduction(fixture([recipe("a", [io("b", 2)], [io("product", 1)]), recipe("b", [io("product", 3)], [io("b", 1)])]), options);
  assert.equal(result.nodes.length, 3);
  assert.equal(result.materials[0].id, "product");
  assert.equal(result.materials[0].amount, 6);
  assert.equal(result.unresolved[0].reason, "cycle");
});
test("autocatalytic recipes use net output and preserve required seed stock", () => {
  const result = calculateProduction(fixture([recipe("a", [io("product", 1), io("feed", 2)], [io("product", 3)])]), { ...options, amount: 4 });
  assert.equal(result.root.batches, 2);
  assert.equal(result.reusable[0].amount, 1);
  assert.equal(result.materials[0].amount, 4);
});
test("consumed empty cells remain requirements; returned cells and zero-amount circuits are stock", () => {
  const result = calculateProduction(fixture([recipe("a", [io("empty cell", 3), io("circuit", 0)], [io("product", 1), io("empty cell", 1)])]), options);
  assert.equal(result.materials.find(row => row.id === "empty cell").amount, 2);
  assert.equal(result.reusable.find(row => row.id === "circuit").amount, 1);
  assert.equal(result.reusable.find(row => row.id === "empty cell").amount, 1);
});
test("ask mode and invalid locked recipe IDs produce unresolved inputs", () => {
  const catalog = fixture([recipe("a", [io("raw", 1)], [io("product", 1)]), recipe("b", [io("raw", 2)], [io("product", 1)])]);
  assert.equal(calculateProduction(catalog, { ...options, routeMode: "ask" }).unresolved[0].reason, "choose-route");
  assert.equal(calculateProduction(catalog, { ...options, routeChoices: { product: "missing" } }).unresolved[0].reason, "invalid-route");
  assert.equal(calculateProduction(catalog, { ...options, routeChoices: { product: "b" } }).materials[0].amount, 2);
});
test("missing timing does not invent machine count or energy", () => {
  const result = calculateProduction(fixture([recipe("crafting", [io("raw", 1)], [io("product", 1)], { durationTicks: null, eut: null })]), { ...options, rateMode: "per_second" });
  assert.equal(result.steps[0].count, null);
  assert.equal(result.hasUnknownPower, true);
});
test("normal/perfect overclocks use 4x EU, 2x/4x speed, tick truncation and parallel lanes", () => {
  const record = recipe("a", [], [], { durationTicks: 25 });
  assert.deepEqual(machinePerformance(record, { overclocks: 1, parallels: 2 }), { durationTicks: 12, parallels: 2, laneEut: 120, eut: 240, batchesPerSecond: 40 / 12 });
  assert.equal(machinePerformance(record, { overclocks: 3, overclockMode: "perfect" }).durationTicks, 1);
  assert.throws(() => machinePerformance(record, { parallels: 0 }));
});
test("node budgets retain boundary materials rather than dropping quantities", () => {
  const records = Array.from({ length: 30 }, (_, i) => recipe(`recipe${i}`, [io(`g${i + 1}`, 1)], [io(i === 0 ? "product" : `g${i}`, 1)]));
  const result = calculateProduction(fixture(records), { ...options, nodeLimit: 10 });
  assert.equal(result.nodes.length, 10);
  assert.equal(result.materials[0].amount, 1);
  assert.equal(result.truncated, true);
});
test("invalid quantities and item/fluid units are rejected", () => {
  const catalog = fixture([recipe("a", [], [io("product", 1)])]);
  for (const amount of [0, -1, NaN, Infinity]) assert.throws(() => calculateProduction(catalog, { ...options, amount }));
  assert.throws(() => calculateProduction(catalog, { ...options, unit: "buckets" }), /fluids/);
});
const data = gunzipSync(readFileSync(new URL("../data/data.bin", import.meta.url)));
const catalog = new RecipeCatalog(Repository.load(data.buffer.slice(data.byteOffset, data.byteOffset + data.length)), { id: "gtnh-2.8.0" });
const epichlorohydrin = catalog.resolve("f:gregtech:liquid_epichlorhydrin");
const routes = catalog.recipes(epichlorohydrin);
const epiOptions = { target: epichlorohydrin.id, amount: 2000, unit: "L", depth: 1, routeChoices: { [epichlorohydrin.id]: "r~7CR1mklsMhyejhfODug_QQ==" } };
test("real epichlorohydrin recipe: 2000 L requires 2 batches, exact materials and 38400 EU", () => {
  const result = calculateProduction(catalog, epiOptions);
  assert.equal(result.root.batches, 2);
  assert.equal(result.materials.find(row => row.name === "Sodium Hydroxide Dust").amount, 6);
  assert.equal(result.materials.find(row => row.name === "Chlorine").amount, 4000);
  assert.equal(result.materials.find(row => row.name === "Mercury").amount, 200);
  assert.equal(result.byproducts.find(row => row.name === "Hydrogen").amount, 4000);
  assert.equal(result.knownEnergy, 38400);
  assert.equal(result.rootTimeSeconds, 64);
  assert.equal(result.reusable.find(row => row.name === "Programmed Circuit").amount, 1);
});
test("real epichlorohydrin throughput: 3000 L/min needs 1.6 base machines, 48 average/60 installed EU/t", () => {
  const result = calculateProduction(catalog, { ...epiOptions, amount: 3000, rateMode: "per_minute" });
  assert.equal(result.requested, 50);
  assert.equal(result.steps[0].equivalents, 1.6);
  assert.equal(result.steps[0].count, 2);
  assert.equal(result.knownAverageEut, 48);
  assert.equal(result.knownInstalledEut, 60);
  assert.equal(result.capacity, 31.25);
});
test("real data bucket conversion, stable recipe IDs and structured metadata remain exact", () => {
  const result = calculateProduction(catalog, { ...epiOptions, amount: 3, unit: "buckets" });
  assert.equal(result.requested, 3000);
  assert.equal(result.root.batches, 3);
  assert.equal(routes[0].durationTicks, 640);
  assert.equal(routes[0].inputs.find(io => io.name === "Programmed Circuit").amount, 0);
  assert.equal(catalog.resolve("i:minecraft:iron_ingot:0").name, "Iron Ingot");
});

test("parallel circuits are one per machine while returned seed materials are per lane", () => {
  const record = recipe("a", [io("circuit",0), io("seed",1)], [io("product",1), io("seed",1)]);
  const result = calculateProduction(fixture([record]), { ...options, machineConfigs: { a: { parallels: 4 } } });
  assert.equal(result.reusable.find(row=>row.id==="circuit").amount,1);
  assert.equal(result.reusable.find(row=>row.id==="seed").amount,4);
});
test("small positive target quantities still require a whole recipe execution", () => {
  const catalog = fixture([recipe("a", [io("raw",1)], [io("product",1e9)])]);
  const result = calculateProduction(catalog, { ...options, amount: .000001 });
  assert.equal(result.root.batches,1);
  assert.equal(result.materials[0].amount,1);
});
test("very small continuous consumption is retained rather than silently discarded", () => {
  const catalog = fixture([recipe("a", [io("raw",1)], [io("product",1e9)])]);
  const result = calculateProduction(catalog, { ...options, amount: .000001, rateMode:"per_second" });
  assert.ok(result.materials[0].amount > 0);
});

test("unknown crafting duration/power is never exported as an invented executable recipe", () => {
  const result=exportRecipeYaml(catalog,"i:minecraft:iron_ingot:0",0);
  assert.equal(result.ok,false);
  assert.match(result.error,/not available/);
  assert.ok(!result.yaml.includes("eut:"));
  assert.ok(!result.yaml.includes("dur:"));
});
test("flow exports preserve distinct IDs even when different fluids share the same name", () => {
  const a={...io("f:moda:steam",1000),name:"Steam",type:"fluid",unit:"L"};
  const b={...io("f:modb:steam",2000),name:"Steam",type:"fluid",unit:"L"};
  const c=fixture([recipe("a",[a,b],[io("product",1)])]);
  const result=calculateProduction(c,options);
  assert.equal(result.materials.length,2);
  const yaml=exportPlanYaml(result);
  assert.match(yaml,/steam \[f:moda:steam\]/);
  assert.match(yaml,/steam \[f:modb:steam\]/);
});
test("ordinary names and prototype property names never enter the raw ID lookup", () => {
  assert.equal(catalog.resolve("constructor"),null);
  assert.equal(catalog.resolve("__proto__"),null);
  assert.equal(catalog.resolve("toString"),null);
});
test("total-craft processing time schedules whole batch waves across machines", () => {
  const c=fixture([recipe("a",[io("raw",1)],[io("product",1)])]);
  assert.equal(calculateProduction(c,{...options,amount:2,machineCount:3}).rootTimeSeconds,10);
  assert.equal(calculateProduction(c,{...options,amount:3,machineCount:2}).rootTimeSeconds,20);
  assert.equal(calculateProduction(c,{...options,amount:3,machineCount:2,rounding:"fractional"}).rootTimeSeconds,15);
  assert.throws(()=>calculateProduction(c,{...options,machineCount:Infinity}),/machine count/);
});
test("total-craft root stock provisions the requested machine count", () => {
  const c=fixture([recipe("a",[io("circuit",0)],[io("product",1)])]);
  const result=calculateProduction(c,{...options,amount:3,machineCount:2});
  assert.equal(result.reusable[0].amount,2);
});
