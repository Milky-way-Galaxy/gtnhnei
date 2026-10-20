import { test } from "node:test";
import assert from "node:assert/strict";
import { describeRouteChoices, filterRouteChoices } from "../route-choices.js";
const io = (id, amount, probability = 1) => ({ id, name: id, amount, probability, unit: "items", type: "item" });
const records = [
  { id: "high-yield", machine: "Assembler", inputs: [], outputs: [io("target", 10)], durationTicks: 200, voltage: 30, amperage: 1, eut: 30 },
  { id: "low-power", machine: "Cutter", inputs: [io("Feed", 1)], outputs: [io("target", 1)], durationTicks: 200, voltage: 8, amperage: 1, eut: 8 },
  { id: "chance", machine: "Assembler", inputs: [], outputs: [io("target", 1, .5)], durationTicks: 20, voltage: 128, amperage: 1, eut: 128 },
  { id: "returned", machine: "Assembler", inputs: [io("target", 2)], outputs: [io("target", 2)], durationTicks: 20, voltage: 30, amperage: 1, eut: 30 },
  { id: "unknown", machine: "Crafting", inputs: [], outputs: [io("target", 1)], durationTicks: null, voltage: null, eut: null }
];
const rows = describeRouteChoices({ recipes: () => records }, { id: "target" });
test("route comparisons order by net-output energy rather than lowest EU/t", () => {
  const ranked = filterRouteChoices(rows); assert.equal(ranked[0].recipe.id, "high-yield");
  assert.equal(ranked[0].metrics.energyPerOutput, 600);
  assert.equal(ranked.at(-1).recipe.id, "returned");
});
test("chance yield and reusable inputs are explicit; zero net yield is ineligible", () => {
  const chance = rows.find(row => row.recipe.id === "chance");
  assert.equal(chance.metrics.output, .5); assert.equal(chance.metrics.expected, true);
  const returned = rows.find(row => row.recipe.id === "returned");
  assert.equal(returned.valid, false); assert.equal(returned.balance.reusable[0].amount, 2);
});
test("voltage, exact machine and ingredient filters preserve unknown-power boundaries", () => {
  assert.deepEqual(filterRouteChoices(rows, { maxVoltage: 8 }).map(row => row.recipe.id), ["low-power"]);
  assert.equal(filterRouteChoices(rows, { machine: "Cutter", query: "feed" })[0].recipe.id, "low-power");
  assert.equal(filterRouteChoices(rows, { query: "missing" }).length, 0);
  assert.ok(filterRouteChoices(rows).some(row => row.recipe.id === "unknown"));
  assert.throws(() => filterRouteChoices(rows, { sort: "invented" }), /Unknown/);
});
