import { Fluid } from "./dist/repository.js";
export const defaultSearchFilters = { type: "all", mod: "", sort: "default", productionOnly: false };
export function filterGoods(goods, filters = defaultSearchFilters) {
  const filtered = goods.filter(good => (filters.type !== "fluid" || good instanceof Fluid) &&
    (filters.type !== "item" || !(good instanceof Fluid)) && (!filters.mod || good.mod === filters.mod) &&
    (!filters.productionOnly || good.production.length > 0));
  const compare = new Intl.Collator("en", { numeric: true, sensitivity: "base" });
  if (filters.sort !== "default") filtered.sort((a, b) => compare.compare(filters.sort === "mod" ? a.mod : filters.sort === "id" ? a.id : a.name,
    filters.sort === "mod" ? b.mod : filters.sort === "id" ? b.id : b.name) || a.id.localeCompare(b.id));
  return filtered;
}
export function mountSearchFilters(catalog, onChange) {
  let filters = { ...defaultSearchFilters };
  const storageKey = `gtnh_atlas_search_filters_${catalog.dataset.id}`;
  try { filters = { ...filters, ...JSON.parse(localStorage.getItem(storageKey) || "{}") }; } catch { /* Defaults work without storage. */ }
  if (!["all", "item", "fluid"].includes(filters.type)) filters.type = "all";
  if (!["default", "name", "mod", "id"].includes(filters.sort)) filters.sort = "default";
  const mods = [...new Set(catalog.goods.map(good => good.mod))].sort();
  if (!mods.includes(filters.mod)) filters.mod = "";
  let panel = document.getElementById("searchFilters");
  if (!panel) { panel = document.createElement("details"); panel.id = "searchFilters"; document.querySelector(".searchSummary").before(panel); }
  panel.innerHTML = '<summary>Search filters <span id="searchFilterBadge"></span><button type="button" id="filterQuickReset" hidden>Reset</button></summary><div class="searchFilterFields"><label>Goods type<select id="filterType"><option value="all">Items and fluids</option><option value="item">Items</option><option value="fluid">Fluids</option></select></label><label>Mod<select id="filterMod"><option value="">All mods</option></select></label><label>Sort<select id="filterSort"><option value="default">Dataset order</option><option value="name">Name</option><option value="mod">Mod</option><option value="id">Item/fluid ID</option></select></label><label class="filterCheck"><input id="filterProduction" type="checkbox"> Has production recipes</label><button type="button" id="filterReset">Reset filters</button></div>';
  for (const mod of mods) { const option = document.createElement("option"); option.value = mod; option.textContent = mod; panel.querySelector("#filterMod").appendChild(option); }
  const sync = () => { panel.querySelector("#filterType").value = filters.type; panel.querySelector("#filterMod").value = filters.mod;
    panel.querySelector("#filterSort").value = filters.sort; panel.querySelector("#filterProduction").checked = filters.productionOnly; };
  const updateBadge = () => {
    const active = Number(filters.type !== "all") + Number(!!filters.mod) + Number(filters.sort !== "default") + Number(filters.productionOnly);
    panel.querySelector("#searchFilterBadge").textContent = active ? `${active} active` : "";
    panel.querySelector("#filterQuickReset").hidden = !active;
  };
  const save = () => { updateBadge(); try { localStorage.setItem(storageKey, JSON.stringify(filters)); } catch { /* Session-only filters. */ } onChange(filters); };
  panel.addEventListener("change", () => { filters = { type: panel.querySelector("#filterType").value, mod: panel.querySelector("#filterMod").value,
    sort: panel.querySelector("#filterSort").value, productionOnly: panel.querySelector("#filterProduction").checked }; save(); });
  const reset = () => { filters = { ...defaultSearchFilters }; sync(); save(); };
  panel.querySelector("#filterReset").addEventListener("click", reset);
  panel.querySelector("#filterQuickReset").addEventListener("click", event => { event.preventDefault(); reset(); });
  sync(); updateBadge(); return filters;
}
