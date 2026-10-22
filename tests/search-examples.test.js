import { test } from "node:test";
import assert from "node:assert/strict";
import { exampleQueries, readSearchHistory, rememberSearch, searchHistoryKey, clearSearchHistory } from "../search-examples.js";
const goods = [
  { id: "i:test:Iron:0", name: "Iron Ingot" }, { id: "i:test:iron:0", name: "Other Iron" },
  { id: "f:test:chloroform", name: "Chloroform" }, { id: "i:test:blood:0", name: "Blood Cell" }
];
const catalog = { goods, resolve: value => goods.find(g => g.id === value || g.name === value) };
test("examples prioritize actual search history and skip missing exact identities", () => {
  assert.deepEqual(exampleQueries(catalog, ["Chloroform", "i:gone:item:0", "i:test:Iron:0"], [{ id: "i:test:blood:0" }]), ["Chloroform", "Iron Ingot", "Blood Cell"]);
  assert.deepEqual(exampleQueries(catalog, ["@greg iron"], [{ id: "i:test:iron:0" }]), ["@greg iron", "Other Iron"]);
});
test("fallbacks come from the active catalog and duplicate hints are omitted", () => {
  assert.deepEqual(exampleQueries(catalog), ["Chloroform", "Blood Cell", "Iron Ingot"]);
  assert.deepEqual(exampleQueries(catalog, ["Iron Ingot"], [{ id: "i:test:Iron:0" }], [{ id: "f:test:chloroform" }]), ["Iron Ingot", "Chloroform"]);
  const custom = { goods: [{ id: "i:other:0", name: "Verified other item" }], resolve: () => null };
  assert.deepEqual(exampleQueries(custom), ["Verified other item"]);
});
test("search history stays bounded, revision-specific and exact-ID case-sensitive", () => {
  const a = { id: "test-search-a", sha256: "one" }, b = { ...a, sha256: "two" };
  globalThis.window = new EventTarget();
  try {
    for (let i = 0; i < 25; i++) rememberSearch(a, `Query ${i}`);
    rememberSearch(a, "i:test:Iron:0"); rememberSearch(a, "i:test:iron:0");
    assert.equal(readSearchHistory(a).length, 20);
    assert.deepEqual(readSearchHistory(a).slice(0, 2), ["i:test:iron:0", "i:test:Iron:0"]);
    assert.deepEqual(readSearchHistory(b), []);
    assert.notEqual(searchHistoryKey(a), searchHistoryKey(b));
    rememberSearch(a, "x"); rememberSearch(a, "x".repeat(201));
    assert.equal(readSearchHistory(a).length, 20);
  } finally { delete globalThis.window; }
});
test("damaged history recovers and clearing one version leaves favorites and other versions alone", () => {
  const a = { id: "test-search-clear", sha256: "a" }, b = { ...a, sha256: "b" }, values = new Map();
  globalThis.window = new EventTarget();
  globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  try {
    values.set(searchHistoryKey(a), "invalid json"); assert.deepEqual(readSearchHistory(a), []);
    values.set(searchHistoryKey(a), JSON.stringify([null, 3, "", "Iron Ingot"])); assert.deepEqual(readSearchHistory(a), ["Iron Ingot"]);
    rememberSearch(b, "Chloroform"); values.set("favorites", "keep");
    clearSearchHistory(a); assert.deepEqual(readSearchHistory(a), []); assert.deepEqual(readSearchHistory(b), ["Chloroform"]); assert.equal(values.get("favorites"), "keep");
  } finally { delete globalThis.localStorage; delete globalThis.window; }
});
