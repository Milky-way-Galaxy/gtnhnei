import assert from "node:assert/strict";
import { test } from "node:test";
import { makerChoiceFor, makerRouteIndex } from "../maker-state.js";

const a = { id: "f:a:water", name: "Water" }, b = { id: "f:b:water", name: "Water" }, iron = { id: "i:iron", name: "Iron Ingot" };
const catalog = { matches: name => [a, b, iron].filter(good => good.name === name), recipes: good => [{ id: `r:${good.id}:first` }, { id: `r:${good.id}:second` }] };

test("exact-ID maker and supply choices cannot leak between same-named goods", () => {
  const state = { makers: { [a.id]: { goodId: a.id, routeIndex: 0 } }, externalInputs: { [b.id]: { goodId: b.id } } };
  assert.equal(makerChoiceFor(state, catalog, a).routeIndex, 0);
  assert.equal(makerChoiceFor(state, catalog, b), null);
  assert.equal(makerChoiceFor(state, catalog, a, "externalInputs"), null);
  assert.equal(makerChoiceFor(state, catalog, b, "externalInputs").goodId, b.id);
});
test("legacy numeric makers survive unique names and do not guess among duplicate names", () => {
  const choice = { routeIndex: 0 }, state = { makers: { ironingot: choice, water: choice }, externalInputs: { water: { name: "water" } } };
  assert.equal(makerChoiceFor(state, catalog, iron), choice);
  assert.equal(makerChoiceFor(state, catalog, a), null);
  assert.equal(makerChoiceFor(state, catalog, b, "externalInputs"), null);
});
test("legacy recipe IDs disambiguate outputs and take precedence over reordered numeric indexes", () => {
  const choice = { recipeId: `r:${a.id}:second`, routeIndex: 0 }, state = { makers: { water: choice } };
  assert.equal(makerChoiceFor(state, catalog, a), choice);
  assert.equal(makerChoiceFor(state, catalog, b), null);
  assert.equal(makerRouteIndex(catalog, a, choice), 1);
  assert.equal(makerRouteIndex(catalog, a, { recipeId: "r:removed", routeIndex: 0 }), -1);
  assert.equal(makerRouteIndex(catalog, a, null, 4), 4);
});
