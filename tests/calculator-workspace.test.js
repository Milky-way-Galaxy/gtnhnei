import { test } from "node:test";
import assert from "node:assert/strict";
import { materialDraftToPlan, readMaterialDraft, factorySettingsSummary } from "../calculator-workspace.js";
import { defaultPlannerState, serializePlan, importPlan } from "../planner-state.js";
const good = { id: "i:test:plate:0", name: "Plate", unit: "items" }, fluid = { id: "f:test:acid", name: "Acid", unit: "L" };
const catalog = { dataset: { id: "gtnh-2.8.0", sha256: "a".repeat(64) }, resolve: name => [good, fluid].find(g => g.id === name || g.name.toLowerCase() === name.toLowerCase()), recipes: () => [{ id: "r:first" }, { id: "r:second" }], describe: g => g };
test("legacy batches, fractional rounding, exact route IDs and explicit supply preferences are retained", () => {
  const { state, issues } = materialDraftToPlan({ target: good.id, amount: 2.5, routeIndex: 1, waterFree: false, ignoreCircuits: false, cellsReusable: false, manualIgnored: ["Acid"] }, catalog);
  assert.equal(state.unit, "batches"); assert.equal(state.amount, 2.5); assert.equal(state.rounding, "fractional");
  assert.equal(state.routeChoices[good.id], "r:second"); assert.equal(state.settings.waterFree, false);
  assert.equal(state.settings.expandCircuits, true); assert.equal(state.settings.cellsReusable, false);
  assert.deepEqual(state.ignored, [fluid.id]); assert.deepEqual(issues, []);
});
test("native fluid units and item stack modes migrate without quantity conversions", () => {
  assert.equal(materialDraftToPlan({ target: fluid.id, amountMode: "target", amount: 1500 }, catalog).state.unit, "L");
  assert.equal(materialDraftToPlan({ target: good.id, amountMode: "stacks", amount: 2 }, catalog).state.unit, "stacks");
});
test("missing routes and materials remain reviewable rather than guessed", () => {
  const { state, issues } = materialDraftToPlan({ target: good.id, routeIndex: 99, manualIgnored: ["Unknown"], amount: 0 }, catalog);
  assert.equal(state.routeMode, "manual"); assert.deepEqual(state.routeChoices, {}); assert.deepEqual(state.ignored, []);
  assert.equal(state.amount, 1); assert.equal(issues.length, 3);
  assert.throws(() => materialDraftToPlan({ target: "Ambiguous plate" }, catalog), /ambiguous/);
});
test("version-scoped legacy reads retain malformed original text without writing storage", () => {
  const originals = new Map([["gtnh_material_calc_state_v3", "broken-json"], ["gtnh_material_calc_state_v4", JSON.stringify({ target: good.id, amount: 3 })]]);
  const storage = { getItem: key => originals.get(key) }, result = readMaterialDraft(catalog, storage);
  assert.equal(result.state.amount, 3); assert.equal(result.originals.gtnh_material_calc_state_v3, "broken-json"); assert.equal(result.issues.length, 1);
  assert.equal(readMaterialDraft({ ...catalog, dataset: { id: "gtnh-2.9.0" } }, storage).state, null);
  assert.equal(readMaterialDraft(catalog, { getItem() { throw new Error("denied"); } }).state, null);
});
test("mode is presentation data while active factory settings remain visible and portable", () => {
  const state = { ...structuredClone(defaultPlannerState), uiMode: "basic", inventory: { [fluid.id]: 10 }, additionalTargets: [{ target: fluid.id, amount: 2, unit: "L" }] };
  const text = serializePlan(state, catalog.dataset), saved = importPlan(text, catalog.dataset);
  assert.equal(JSON.parse(text).schemaVersion, 2); assert.equal(saved.uiMode, "basic");
  assert.equal(factorySettingsSummary(saved).length, 2); assert.deepEqual(saved.inventory, state.inventory);
});
