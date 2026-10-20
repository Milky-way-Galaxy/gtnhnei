import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { machinePerformance, validateMachineConfig, tierVoltages, ebfRecipeHeat, heatingCoils, heatingCoilsForRuleset, ebfMachineHeat } from "../machine-model.js";
import { initialMachineConfig } from "../machine-profile-ui.js";
import { normalizePlannerState, importPlan, serializePlan } from "../planner-state.js";
const ebf = { durationTicks: 1380, eut: 7680, specialValue: 5400,
  metadata: [{ key: "coil_heat", value: 5400 }], crafters: [{ id: "i:gregtech:gt.blockmachines:1000" }] };
const base = { model: "ebf", ruleset: "gt5-5.09.51.470", voltageTier: 6, machineHeat: 7200 };
test("checked machine models match original pinned Java calculators, including power-rounding differences", () => {
  const reference = JSON.parse(readFileSync(new URL("./fixtures/gt5-machine-reference.json", import.meta.url), "utf8"));
  let compared = 0, safelyRejected = 0;
  for (const [ruleset, expected] of Object.entries(reference.expected)) for (const [index, entry] of reference.cases.entries()) {
    const recipe = { ...ebf, eut: entry.eut, durationTicks: entry.duration, specialValue: entry.recipeHeat,
      metadata: [{ key: "coil_heat", value: entry.recipeHeat }] };
    const config = { model: entry.recipeHeat >= 0 ? "ebf" : "gt5", ruleset, voltageTier: entry.tier,
      machineAmperage: entry.amps, parallels: entry.parallels, maxOverclocks: entry.cap,
      overclockMode: entry.perfect ? "perfect" : "normal", amperageOC: entry.ampOC, machineHeat: entry.heat };
    const [ticks, eut, overclocks] = expected[index];
    if (eut > tierVoltages[entry.tier] * entry.amps) {
      // The old Java calculator can round a discounted recipe into an OC which
      // exceeds its input budget. Atlas deliberately refuses this unsafe result.
      assert.throws(() => machinePerformance(recipe, config), /exceeds available power/); safelyRejected++; continue;
    }
    const result = machinePerformance(recipe, config);
    assert.deepEqual([result.durationTicks, result.eut, result.overclocks], [ticks, eut, overclocks], `${ruleset} vector ${index}`);
    assert.equal(result.batchesPerSecond, entry.parallels * 20 / ticks);
    assert.equal(result.laneEut, eut / entry.parallels);
    compared++;
  }
  assert.ok(compared > 400); assert.ok(safelyRejected > 0);
});
test("EBF heat thresholds apply multiplicative discounts and heat-perfect OCs to known recipe values", () => {
  const result = machinePerformance(ebf, base);
  assert.equal(result.overclocks, 1); assert.equal(result.heatOverclocks, 1);
  assert.equal(result.heatDiscounts, 2); assert.equal(result.durationTicks, 345);
  assert.equal(result.eut, 27725); assert.equal(result.availableEut, 32768);
  assert.equal(machinePerformance(ebf, { ...base, machineHeat: 6299 }).heatDiscounts, 0);
  assert.equal(machinePerformance(ebf, { ...base, machineHeat: 6300 }).eut, 29184);
  assert.equal(machinePerformance(ebf, { ...base, machineHeat: 7199 }).durationTicks, 690);
});
test("verified heating coils include the EBF voltage bonus and reject physically insufficient coils", () => {
  const reference = JSON.parse(readFileSync(new URL("./fixtures/gt5-machine-reference.json", import.meta.url),"utf8"));
  for (const expected of Object.values(reference.coils)) assert.deepEqual(heatingCoils.map(coil => [coil.level, coil.heat]), expected);
  for (const [ruleset, expected] of Object.entries(reference.coilNames)) assert.deepEqual(heatingCoilsForRuleset(ruleset).map(coil => coil.name), expected);
  assert.equal(ebfMachineHeat({...base, coilLevel:8}),7601);
  assert.equal(ebfMachineHeat({...base, coilLevel:8, voltageTier:7}),7701);
  const physical = machinePerformance(ebf,{...base,coilLevel:8});
  assert.equal(physical.machineHeat,7601); assert.equal(physical.durationTicks,345); assert.equal(physical.eut,27725);
  assert.throws(()=>machinePerformance(ebf,{...base,coilLevel:2}),/Insufficient EBF heat/);
});
test("ULV, integer voltage tiers, amp OC opt-in, tick floor and explicit OC caps are respected", () => {
  const recipe = { eut: 7, durationTicks: 3 }, cfg = { model: "gt5", voltageTier: 2, machineAmperage: 4 };
  assert.equal(machinePerformance(recipe, cfg).overclocks, 1);
  assert.equal(machinePerformance(recipe, { ...cfg, amperageOC: true }).overclocks, 2);
  assert.equal(machinePerformance(recipe, { ...cfg, maxOverclocks: 0 }).durationTicks, 3);
  assert.equal(machinePerformance(recipe, { ...cfg, amperageOC: true }).tickLimited, true);
  assert.equal(machinePerformance({ eut: 33, durationTicks: 200 }, { model: "gt5", voltageTier: 2 }).overclocks, 0);
});
test("invalid heat, unsupported variants and impossible power profiles are rejected instead of inventing production", () => {
  assert.throws(() => machinePerformance(ebf, { ...base, machineHeat: 5399 }), /Insufficient EBF heat/);
  assert.throws(() => machinePerformance(ebf, { ...base, voltageTier: 4 }), /Insufficient input power/);
  assert.throws(() => machinePerformance(ebf, { ...base, voltageTier: 3 }), /voltage-skip/);
  assert.throws(() => machinePerformance(ebf, { ...base, parallels: 2 }), /one lane/);
  assert.throws(() => machinePerformance(ebf, { ...base, overclockMode: "perfect" }), /excess heat/);
  assert.equal(ebfRecipeHeat({ ...ebf, crafters: [{ name: "Electric Blast Furnace" }] }), null);
  assert.equal(ebfRecipeHeat({ ...ebf, specialValue: 1 }), null);
  assert.throws(() => machinePerformance({ ...ebf, crafters: [] }, base), /verified Electric Blast Furnace/);
  assert.equal(machinePerformance({ ...ebf, eut: undefined }, base), null);
});
test("old generic profiles retain their results and checked settings survive dataset-bound JSON", () => {
  assert.deepEqual(machinePerformance({ eut: 30, durationTicks: 25 }, { parallels: 2, overclocks: 1 }),
    { durationTicks: 12, parallels: 2, laneEut: 120, eut: 240, batchesPerSecond: 40 / 12 });
  const dataset = { id: "gtnh-2.8.0", sha256: "a".repeat(64) };
  const state = normalizePlannerState({ machineConfigs: { real: base, legacy: { parallels: 4, overclocks: 2 } } });
  assert.deepEqual(importPlan(serializePlan(state, dataset), dataset), state);
  for (const bad of [null, [], {model:"invented"}, {ruleset:"latest"}, {maxOverclocks:15}, {voltageTier:-1}, {amperageOC:"false"}, {parallels:""}]) {
    assert.throws(() => validateMachineConfig(bad));
    assert.throws(() => normalizePlannerState({ machineConfigs: { a: bad } }));
  }
});
test("switching profiles supplies explicit defaults without overwriting a saved generic OC count", () => {
  const checked = initialMachineConfig(ebf, {overclocks:3, parallels:4}, "ebf", "gtnh-2.8.0");
  assert.equal(checked.machineHeat, 5400); assert.equal(checked.voltageTier, 5);
  assert.equal(checked.parallels, 1); assert.equal(checked.overclocks, 3);
  assert.equal(machinePerformance(ebf, checked).durationTicks, 1380);
  assert.equal(machinePerformance(ebf, initialMachineConfig(ebf, checked, "generic", "gtnh-2.8.0")).durationTicks,172);
});
