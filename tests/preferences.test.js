import { test } from "node:test";
import assert from "node:assert/strict";
import { getPreference, setPreference, removePreference } from "../preferences.js";
test("readable storage with blocked writes still honors this tab's new preference and deletion", () => {
  const values = new Map([["quota-preference", "old"]]); let blocked = true;
  globalThis.localStorage = {
    getItem: key => values.get(key) ?? null,
    setItem(key, value) { if (blocked) throw new DOMException("Full", "QuotaExceededError"); values.set(key, value); },
    removeItem(key) { if (blocked) throw new DOMException("Blocked", "SecurityError"); values.delete(key); }
  };
  try {
    setPreference("quota-preference", "new"); assert.equal(getPreference("quota-preference"), "new"); assert.equal(values.get("quota-preference"), "old");
    removePreference("quota-preference"); assert.equal(getPreference("quota-preference", "default"), "default");
    blocked = false; setPreference("quota-preference", "saved"); assert.equal(values.get("quota-preference"), "saved");
    values.set("quota-preference", "external change"); assert.equal(getPreference("quota-preference"), "external change");
    removePreference("quota-preference"); assert.equal(getPreference("quota-preference"), null);
  } finally { delete globalThis.localStorage; }
});
test("unavailable browser storage keeps preferences usable for this tab", () => {
  setPreference("blocked-preference", "0"); assert.equal(getPreference("blocked-preference"), "0");
  removePreference("blocked-preference"); assert.equal(getPreference("blocked-preference", "fallback"), "fallback");
});
