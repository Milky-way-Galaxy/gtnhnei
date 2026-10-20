import { test } from "node:test";
import assert from "node:assert/strict";
import { PlanLibrary, libraryKey } from "../plan-library.js";
import { defaultPlannerState } from "../planner-state.js";
const dataset = { id: "gtnh-2.8.0", sha256: "a".repeat(64) };
function storage() {
  const data = new Map();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
  };
}
test("named factory plans save, load, update, delete and undo without losing route/stock settings", () => {
  const store = storage(),
    library = new PlanLibrary(store, dataset),
    state = {
      ...defaultPlannerState,
      target: "i:minecraft:iron_ingot:0",
      inventory: { "i:minecraft:iron_ingot:0": 5 },
      additionalTargets: [{ target: "f:water", amount: 1000, unit: "L" }],
    };
  const saved = library.save("  Iron works  ", state);
  assert.equal(saved.name, "Iron works");
  assert.deepEqual(library.load(saved.id).inventory, state.inventory);
  assert.equal(library.load(saved.id).additionalTargets.length, 1);
  library.save("Revised works", { ...state, amount: 2 }, saved.id);
  assert.equal(library.read().length, 1);
  assert.equal(library.load(saved.id).amount, 2);
  const removed = library.remove(saved.id);
  assert.equal(library.read().length, 0);
  library.restore(removed);
  assert.equal(library.read()[0].name, "Revised works");
  assert.throws(() => library.restore(removed), /already exists/);
});
test("plan libraries are isolated by dataset identity and export checksum", () => {
  const store = storage(),
    library = new PlanLibrary(store, dataset);
  library.save("Original", defaultPlannerState);
  assert.equal(
    new PlanLibrary(store, { ...dataset, id: "gtnh-2.9.0" }).read().length,
    0,
  );
  assert.equal(
    new PlanLibrary(store, { ...dataset, sha256: "b".repeat(64) }).read()
      .length,
    0,
  );
  assert.equal(library.read().length, 1);
});
test("corrupt or incompatible libraries are never overwritten by a save attempt", () => {
  const store = storage(),
    library = new PlanLibrary(store, dataset);
  for (const text of [
    "bad json",
    JSON.stringify({
      format: "gtnh-atlas-library",
      schemaVersion: 5,
      plans: [],
    }),
  ]) {
    store.setItem(libraryKey(dataset), text);
    assert.throws(() => library.save("New", defaultPlannerState), /retained/);
    assert.equal(store.getItem(libraryKey(dataset)), text);
  }
});
test("quota failures and invalid names retain every earlier plan", () => {
  const store = storage(),
    library = new PlanLibrary(store, dataset),
    saved = library.save("Valid", defaultPlannerState),
    before = store.getItem(libraryKey(dataset));
  for (const name of ["", "a".repeat(101)])
    assert.throws(() => library.save(name, defaultPlannerState), /name/);
  assert.equal(store.getItem(libraryKey(dataset)), before);
  store.setItem = () => {
    throw new Error("quota");
  };
  assert.throws(() => library.remove(saved.id), /retained/);
  assert.equal(library.read().length, 1);
});
test("independent tabs read current storage before mutating their library", () => {
  const store = storage(),
    first = new PlanLibrary(store, dataset),
    second = new PlanLibrary(store, dataset);
  first.save("One", defaultPlannerState);
  second.save("Two", defaultPlannerState);
  assert.equal(first.read().length, 2);
});
