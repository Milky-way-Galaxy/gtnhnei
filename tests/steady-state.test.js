import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { Repository } from "../dist/repository.js";
import { RecipeCatalog } from "../recipe-data.js";
import { calculateProduction } from "../production-engine.js";
import { solveUniqueBalance } from "../steady-state.js";
import { defaultPlannerState, importPlan, serializePlan } from "../planner-state.js";
import { exportPlanYaml, planCsv, machinesCsv } from "../recipe-export.js";
import { buildSupplyPlan, supplyCsv } from "../supply-plan.js";

test("unique rectangular balances satisfy redundant equations and preserve tiny demands", () => {
  const solved = solveUniqueBalance([[2, 0], [-1, 1], [1, -1]], [1, 0, 0]);
  assert.deepEqual(solved.rates, [.5, .5]); assert.equal(solved.residual, 0);
  assert.deepEqual(solveUniqueBalance([[1]], [1e-15]).rates, [1e-15]);
  assert.throws(() => solveUniqueBalance([[1, -1], [-1, 1]], [0, 0]), /unique/);
  assert.throws(() => solveUniqueBalance([[1], [1]], [1, 2]), /inconsistent/);
  assert.throws(() => solveUniqueBalance([[1]], [-1]), /nonnegative/);
});
const bytes = gunzipSync(readFileSync(new URL("../data/data.bin", import.meta.url)));
const catalog = new RecipeCatalog(Repository.load(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length)), { id: "gtnh-2.8.0", sha256: "a".repeat(64) });
const product = "f:gregtech:tetranitromethane", empty = "i:IC2:itemCellEmpty:0", filled = "i:gregtech:gt.metaitem.01:30641";
const reactor = "r~-5WYqt_OOQOL1KobhH2Etg==", canner = "r~9HnaZz-0MLGhv9LG6kwENw==";
const options = { target: product, amount: 2000, unit: "L", rateMode: "per_second", depth: "full", balanceMode: "steady_state",
  routeChoices: { [product]: reactor, [filled]: canner }, externalInputs: ["f:dreamcraft:nitricacid", "f:gregtech:ethenone"], loopSeeds: { [empty]: 2 } };
test("real guaranteed cell loop consumes feedstock and power, never recurring empty cells", () => {
  const plan = calculateProduction(catalog, options);
  assert.equal(plan.balance.status, "balanced"); assert.equal(plan.steps.length, 2);
  assert.equal(plan.materials.find(row => row.name === "Nitric Acid").amount, 8000);
  assert.equal(plan.materials.find(row => row.name === "Ethenone").amount, 1000);
  assert.equal(plan.materials.some(row => [empty, filled].includes(row.id)), false);
  assert.equal(plan.steps.find(row => row.recipeId === reactor).batches, 1);
  assert.equal(plan.steps.find(row => row.recipeId === reactor).count, 24);
  assert.equal(plan.steps.find(row => row.recipeId === canner).count, 1);
  assert.equal(plan.knownAverageEut, 2880.8); assert.equal(plan.knownInstalledEut, 2881);
  assert.equal(plan.reusable.find(row => row.id === empty).amount, 2);
  assert.equal(plan.reusable.find(row => row.name === "Programmed Circuit").amount, 24);
  assert.equal(plan.byproductsUsed.find(row => row.id === empty).amount, 1);
  assert.equal(plan.balance.loops.length, 1); assert.equal(plan.balance.startupValidated, false);
  assert.match(plan.warnings.join(" "), /startup sequence/);
  const supply = buildSupplyPlan(plan, { seconds: 7200 }, catalog);
  assert.equal(supply.startup.find(row => row.id === empty).amount, 2);
  assert.equal(supply.consumption.find(row => row.name === "Ethenone").amount, 7200000);
  for (const text of [planCsv(plan), machinesCsv(plan), supplyCsv(supply)]) { assert.match(text, /Balance status/); assert.match(text, /steady_state/); }
});
test("missing seed, chance recipes, total jobs and incomplete routes remain visibly blocked", () => {
  const missingSeed = calculateProduction(catalog, { ...options, loopSeeds: {} });
  assert.equal(missingSeed.balance.status, "blocked"); assert.match(missingSeed.balance.reason, /Declare/); assert.equal(missingSeed.balance.loops.length, 1);
  assert.match(exportPlanYaml(missingSeed), /No executable recycling plan/);
  assert.equal(buildSupplyPlan(missingSeed, { seconds: 7200 }, catalog).partial, true);
  const missingRoute = calculateProduction(catalog, { ...options, routeChoices: { [product]: reactor } });
  assert.equal(missingRoute.balance.status, "blocked"); assert.match(missingRoute.warnings[0], /recursive boundary estimates/);
  assert.equal(calculateProduction(catalog, { ...options, rateMode: "total" }).balance.status, "blocked");
  const chanceCatalog = Object.create(catalog);
  chanceCatalog.recipes = good => catalog.recipes(good).map(recipe => recipe.id === reactor ? { ...recipe, outputs: recipe.outputs.map(io => ({ ...io, probability: .5 })) } : recipe);
  assert.match(calculateProduction(chanceCatalog, options).balance.reason, /guaranteed/);
});
test("unused choices and discovery order do not change the real loop result", () => {
  const forward = calculateProduction(catalog, options), reverse = calculateProduction(catalog, { ...options, routeChoices: Object.fromEntries(Object.entries(options.routeChoices).reverse()) });
  assert.deepEqual(forward.materials, reverse.materials); assert.equal(forward.knownAverageEut, reverse.knownAverageEut);
});
test("format 4 preserves circulating stock and old numeric formats cannot claim these semantics", () => {
  const state = { ...structuredClone(defaultPlannerState), ...options, uiMode: "factory" };
  const json = serializePlan(state, catalog.dataset); assert.equal(JSON.parse(json).schemaVersion, 4);
  assert.deepEqual(importPlan(json, catalog.dataset).loopSeeds, { [empty]: 2 });
  const old = JSON.parse(json); old.schemaVersion = 3; assert.throws(() => importPlan(JSON.stringify(old), catalog.dataset), /Unsupported/);
});
