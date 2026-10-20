import { test } from "node:test";
import assert from "node:assert/strict";
import { pickerGoods } from "../item-picker.js";
const goods = [
  { id: "i:mod:Same:0", name: "Same", mod: "GregTech", production: [1] },
  { id: "i:mod:same:0", name: "Same", mod: "Other", production: [] },
  { id: "f:mod:acid", name: "Diluted Sulfuric Acid", mod: "GregTech", production: [1] },
];
const catalog = { goods, resolve: id => goods.find(good => good.id === id) };
test("picker supports word search, mod search, type and recipe filters", () => {
  assert.deepEqual(pickerGoods(catalog, { query: "dil acid @greg", type: "fluid", productionOnly: true }), [goods[2]]);
  assert.deepEqual(pickerGoods(catalog, { mod: "Other", type: "item" }), [goods[1]]);
});
test("exact IDs preserve case and duplicate names remain individually selectable", () => {
  assert.deepEqual(pickerGoods(catalog, { query: "i:mod:Same:0" }), [goods[0]]);
  assert.deepEqual(pickerGoods(catalog, { query: "i:mod:SAME:0" }), []);
  assert.deepEqual(pickerGoods(catalog, { query: "same" }), goods.slice(0, 2));
});
test("favorites and recents preserve saved order and skip absent or legacy names", () => {
  const saved = { favorites: [{ id: goods[2].id }, { name: "Same" }, { id: "i:gone:0" }, { id: goods[0].id }] };
  assert.deepEqual(pickerGoods(catalog, { source: "favorites" }, saved), [goods[2], goods[0]]);
  assert.deepEqual(pickerGoods(catalog, { source: "recent" }, saved), []);
});
