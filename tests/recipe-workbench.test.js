import { test } from "node:test";
import assert from "node:assert/strict";
import { filterRecipeEntries, recipeBrowseEntry } from "../recipe-browse.js";
import { recipePlanState } from "../recipe-plan.js";
import { defaultPlannerState } from "../planner-state.js";
const io = (id, amount = 1, probability = 1) => ({ id, name: id, amount, probability, type: "item", unit: "items" });
const recipes = [
  { id: "unknown", machine: "Crafting", inputs: [], outputs: [io("i:target")], durationTicks: null, voltage: null, eut: null },
  { id: "fast", machine: "Assembler", inputs: [io("i:Feed")], outputs: [io("i:target", 1, .5)], durationTicks: 20, voltage: 128, eut: 256 },
  { id: "low", machine: "Cutter", inputs: [io("i:Feed")], outputs: [io("i:target")], durationTicks: 200, voltage: 8, eut: 8 },
  { id: "returned", machine: "Cutter", inputs: [io("i:target")], outputs: [io("i:target")], durationTicks: 200, voltage: 8, eut: 8 }
];
const entries = recipes.map(recipeBrowseEntry);
test("recipe browsing combines case-insensitive ingredient/ID words and checked voltage", () => {
  assert.deepEqual(filterRecipeEntries(entries, { query: "FEED cutter", maxVoltage: 8 }).map(row => row.recipe.id), ["low"]);
  assert.equal(filterRecipeEntries(entries).length, 4);
  assert.equal(filterRecipeEntries(entries, { maxVoltage: 0 }).length, 0);
  assert.equal(filterRecipeEntries(entries, { query: "i:feed", noChance: true }).length, 1);
});
test("base batch ranking keeps unknown values last and never mutates the dataset order", () => {
  assert.deepEqual(filterRecipeEntries(entries, { sort: "energy" }).map(row => row.recipe.id), ["low", "returned", "fast", "unknown"]);
  assert.equal(filterRecipeEntries(entries, { sort: "duration" })[0].recipe.id, "fast");
  assert.deepEqual(entries.map(row => row.recipe.id), recipes.map(recipe => recipe.id));
});
const good = { id: "i:target", name: "Target" }, catalog = {
  resolve: id => id === good.id ? good : null, describe: () => ({ unit: "items" }), recipes: () => recipes
};
test("starting an exact recipe preserves unrelated settings and removes target supply overrides", () => {
  const before = { ...structuredClone(defaultPlannerState), target: "i:previous", amount: 17,
    inventory: { "i:stock": 9 }, rawOverrides: ["i:target", "i:other"], ignored: ["target"], additionalTargets: [{ target: "i:extra", amount: 1, unit: "items" }] };
  const next = recipePlanState(before, catalog, good.id, "low");
  assert.equal(next.routeChoices[good.id], "low"); assert.equal(next.amount, 1);
  assert.deepEqual(next.inventory, before.inventory); assert.deepEqual(next.rawOverrides, ["i:other"]);
  assert.deepEqual(next.ignored, []); assert.deepEqual(next.additionalTargets, []);
  assert.equal(before.target, "i:previous"); assert.equal(before.amount, 17);
});
test("foreign, missing, nonpositive-net recipes cannot replace the draft", () => {
  for (const recipeId of ["returned", "missing", "from-other-version"]) assert.throws(() => recipePlanState(defaultPlannerState, catalog, good.id, recipeId), /positive net/);
  assert.throws(() => recipePlanState(defaultPlannerState, catalog, "Target", "low"), /exact item/);
});
