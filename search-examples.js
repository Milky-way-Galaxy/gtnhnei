import { ItemLibrary } from "./item-library.js";
import { getPreference, setPreference, removePreference } from "./preferences.js";

const ROTATION_KEY = "gtnh_atlas_rotating_examples_v1";
const HISTORY_EVENT = "gtnh-search-examples-changed";
export const searchHistoryKey = dataset => `gtnh_atlas_search_history_v1_${dataset.id}_${dataset.sha256 || ""}`;
export function readSearchHistory(dataset) {
  try {
    const value = JSON.parse(getPreference(searchHistoryKey(dataset), "[]"));
    return Array.isArray(value) ? [...new Set(value.filter(q => typeof q === "string" && q.trim() && q.length <= 200))].slice(0, 20) : [];
  } catch { return []; }
}
export function rememberSearch(dataset, query) {
  const value = query.trim();
  if (value.length < 2 || value.length > 200) return;
  setPreference(searchHistoryKey(dataset), JSON.stringify([value, ...readSearchHistory(dataset).filter(q => q !== value)].slice(0, 20)));
  window.dispatchEvent(new Event(HISTORY_EVENT));
}
export function clearSearchHistory(dataset) {
  removePreference(searchHistoryKey(dataset));
  window.dispatchEvent(new Event(HISTORY_EVENT));
}
export const rotatingExamples = () => getPreference(ROTATION_KEY) !== "0";
export function setRotatingExamples(enabled) {
  setPreference(ROTATION_KEY, enabled ? "1" : "0");
  window.dispatchEvent(new Event(HISTORY_EVENT));
}

export function exampleQueries(catalog, history = [], recent = [], favorites = []) {
  const result = [], seen = new Set();
  function add(query) {
    if (!query || seen.has(query)) return;
    seen.add(query); result.push(query);
  }
  for (const query of history) {
    // An exact ID from a missing export must not become a misleading example.
    const good = catalog.resolve(query);
    if (/^[ifo]:/.test(query)) { if (good) add(good.name || query); }
    else add(good?.name || query);
  }
  for (const entry of [...recent, ...favorites]) {
    const good = entry.id && catalog.resolve(entry.id);
    if (good) add(good.name || good.id);
  }
  // Resolve every fallback against the current data. No invented or cross-version
  // item is shown, and recent searches always come first.
  if (!result.length) for (const name of ["Chloroform", "Blood Cell", "Steel Ingot", "Iron Ingot", "Sulfuric Acid", "Oxygen"]) {
    const good = catalog.resolve(name) || catalog.matches?.(name)?.[0];
    if (good) add(good.name);
  }
  if (!result.length) for (const good of catalog.goods.slice(0, 6)) add(good.name || good.id);
  return result.slice(0, 12);
}

export function recentExampleGoods(catalog, limit = 4) {
  try { return new ItemLibrary(catalog, localStorage).read().recent.map(entry => catalog.resolve(entry.id)).filter(Boolean).slice(0, limit); }
  catch { return []; }
}

// Placeholders are hints, never input values. One timer per visible empty field;
// focus, text, reduced motion, hidden tabs and closed dialogs pause rotation.
export function bindSearchExamples(input, getCatalog, { prefix = "e.g. " } = {}) {
  const original = input.placeholder, motion = matchMedia("(prefers-reduced-motion: reduce)"), controller = new AbortController();
  let timer, queries = [], index = 0;
  const stop = () => { clearTimeout(timer); timer = undefined; };
  function eligible() {
    return input.isConnected && !input.disabled && !input.value && document.activeElement !== input &&
      !document.hidden && input.getClientRects().length && !input.closest("dialog:not([open])");
  }
  function tick() {
    stop();
    if (!eligible()) return;
    if (queries.length) input.placeholder = prefix + queries[index % queries.length];
    if (queries.length > 1 && rotatingExamples() && !motion.matches) timer = setTimeout(() => {
      if (!eligible() || !rotatingExamples() || motion.matches) { stop(); return; }
      index++; tick();
    }, 1000);
  }
  function refresh() {
    stop();
    const catalog = getCatalog();
    if (!catalog) return;
    let saved = {};
    try { saved = new ItemLibrary(catalog, localStorage).read(); } catch { /* Examples also work without saved items. */ }
    const current = queries[index % queries.length];
    queries = exampleQueries(catalog, readSearchHistory(catalog.dataset), saved.recent, saved.favorites);
    index = Math.max(0, queries.indexOf(current));
    tick();
  }
  const listen = (target, name, callback) => target.addEventListener(name, callback, { signal: controller.signal });
  listen(input, "focus", stop); listen(input, "input", tick); listen(input, "blur", refresh);
  listen(document, "visibilitychange", refresh); listen(motion, "change", refresh);
  listen(window, HISTORY_EVENT, refresh); listen(window, "gtnh-library-changed", refresh);
  refresh();
  return { refresh, pause: stop, destroy() { stop(); controller.abort(); input.placeholder = original; } };
}
