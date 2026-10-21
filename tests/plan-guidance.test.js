import { test } from "node:test";
import assert from "node:assert/strict";
import { compareProductionPlans } from "../plan-comparison.js";
import { planDiagnostics } from "../plan-diagnostics.js";
const base = { dataset: { id: "pack", sha256: "a" }, isRate: false, materials: [], steps: [], unresolved: [], warnings: [], knownEnergy: 10 };
test("route previews compare exact material identities and retain partial-result flags", () => {
  const before = { ...base, materials: [{ id: "i:A:0", name: "Same", amount: 2, unit: "items" }], hasUnknownPower: true };
  const after = { ...base, materials: [{ id: "i:B:0", name: "Same", amount: 3, unit: "items" }], knownEnergy: 20 };
  const diff = compareProductionPlans(before, after);
  assert.deepEqual(diff.materials.map(row => [row.id, row.before, row.after, row.delta]), [["i:A:0", 2, 0, -2], ["i:B:0", 0, 3, 3]]);
  assert.equal(diff.knownPower.delta, 10); assert.equal(diff.partial, true); assert.equal(before.materials[0].amount, 2);
  assert.equal(compareProductionPlans(base, { ...base, balance: { status: "blocked" } }).partial, true);
  assert.throws(() => compareProductionPlans(base, { ...base, dataset: { id: "other" } }), /same recipe dataset/);
});
test("cycle inspection follows actual ancestors, deduplicates loops and separates supplied boundaries", () => {
  const plan = { nodes: [
    { key: 0, parent: null, id: "A", name: "A", status: "produced", recipeId: "rA" },
    { key: 1, parent: 0, id: "B", name: "B", status: "produced", recipeId: "rB" },
    { key: 2, parent: 1, id: "A", name: "A", status: "cycle" },
    { key: 3, parent: 0, id: "C", name: "C", status: "choose-route" },
    { key: 4, parent: 0, id: "C", name: "C", status: "choose-route" },
    { key: 5, parent: 0, id: "ore", name: "Ore", status: "no-recipe" },
    { key: 6, parent: 0, id: "depth", name: "Depth", status: "depth-limit" },
  ], steps: [{ recipeId: "rA", machine: "A", performance: null, recipe: { specialValue: 12 } }] };
  const result = planDiagnostics(plan);
  assert.deepEqual(result.cycles[0].goods.map(row => row.id), ["A", "B", "A"]);
  assert.deepEqual(result.cycles[0].recipeIds, ["rA", "rB"]);
  assert.equal(result.attention.find(row => row.id === "C").occurrences, 2);
  assert.equal(result.supplies.length, 2); assert.equal(result.unknownMachines.length, 1); assert.equal(result.conditionalRecipes.length, 1);
});
