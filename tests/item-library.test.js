import { test } from "node:test";
import assert from "node:assert/strict";
import { ItemLibrary, libraryKey, legacyFavoritesKey } from "../item-library.js";
const goods = [{ id: "i:mod:Case", name: "Shared" }, { id: "i:mod:case", name: "Shared" }, { id: "f:water", name: "Water" }];
function setup() {
  const map = new Map(), storage = { getItem: key => map.get(key) || null, setItem: (key, value) => map.set(key, value) };
  const catalog = { dataset: { id: "gtnh-2.8.0", sha256: "a".repeat(64) }, resolve: query => goods.find(g => g.id === query) || (goods.filter(g => g.name === query).length === 1 ? goods.find(g => g.name === query) : null) };
  return { map, storage, catalog, library: new ItemLibrary(catalog, storage) };
}
test("favorites preserve case-distinct exact IDs and toggle independently", () => {
  const { library } = setup(); library.toggle(goods[0].id); library.toggle(goods[1].id);
  assert.equal(library.read().favorites.length, 2);
  library.toggle(goods[0].id); assert.equal(library.read().favorites[0].id, goods[1].id);
});
test("legacy names migrate only on unique exact matches and old storage is untouched", () => {
  const { library, map, catalog } = setup(), key = legacyFavoritesKey(catalog.dataset);
  const old = JSON.stringify([{ name: "Water", addedAt: 1 }, { name: "Shared" }, { name: "Missing" }]);
  map.set(key, old);
  assert.deepEqual(library.read().favorites.map(entry => entry.id), ["f:water", null, null]);
  library.toggle(goods[0].id); assert.equal(map.get(key), old);
  assert.equal(library.read().favorites.length, 4);
});
test("history is bounded and deduplicated by exact ID with the newest mode", () => {
  const { library } = setup(); library.visit(goods[0].id); library.visit(goods[1].id); library.visit(goods[0].id, "usage");
  assert.equal(library.read().recent.length, 2); assert.equal(library.read().recent[0].mode, "usage");
  library.clearRecent(); assert.deepEqual(library.read().recent, []);
});
test("portable imports merge IDs and reject other versions/revisions before writing", () => {
  const { library, map, catalog } = setup(); library.toggle(goods[0].id); const exported = library.export(); library.toggle(goods[1].id);
  library.import(exported); assert.equal(library.read().favorites.length, 2);
  const before = map.get(libraryKey(catalog.dataset)), wrong = JSON.parse(exported); wrong.dataset.sha256 = "b".repeat(64);
  assert.throws(() => library.import(JSON.stringify(wrong)), /different recipe dataset/);
  assert.equal(map.get(libraryKey(catalog.dataset)), before);
});
test("damaged saved libraries are retained for recovery and never replaced by visits", () => {
  const { library, map, catalog } = setup(); map.set(libraryKey(catalog.dataset), "{broken");
  assert.throws(() => library.visit("f:water"), /backup/);
  assert.equal(library.rawBackup(), "{broken");
  assert.equal(map.get(libraryKey(catalog.dataset)), "{broken");
});
test("invalid and oversized imports cannot partially change favorites", () => {
  const { library } = setup(); const state = JSON.parse(library.export());
  state.favorites = Array.from({ length: 501 }, () => ({ id: "f:water", name: "Water", time: 0 }));
  assert.throws(() => library.import(JSON.stringify(state)), /limits exceeded/);
  assert.equal(library.read().favorites.length, 0);
  assert.throws(() => library.import("x".repeat(2_000_001)), /too large/);
});
