import { SearchQuery } from "./dist/searchQuery.js";
import { ItemLibrary } from "./item-library.js";
import { createDialog, escapeHtml as esc } from "./ui-dialog.js";

export function pickerGoods(catalog, { query = "", type = "all", mod = "", source = "all", productionOnly = false } = {}, saved = {}) {
  const raw = query.trim(), parsed = new SearchQuery(raw);
  const goods = source === "all" ? catalog.goods : (saved[source] || []).map(entry => catalog.resolve(entry.id)).filter(Boolean);
  const exact = /^[if]:/.test(raw) ? catalog.resolve(raw) : null;
  return goods.filter(good => (type === "all" || (good.id.startsWith("f:") ? "fluid" : "item") === type) &&
    (!mod || good.mod === mod) && (!parsed.mod || (good.mod || "").toLowerCase().includes(parsed.mod)) &&
    (!productionOnly || good.production.length > 0) &&
    (/^[if]:/.test(raw) ? good.id === exact?.id : parsed.Match(`${good.name} ${good.id}`)));
}

let dialog, activeCatalog, onSelect, matches = [], page = 0, source = "all", saved = {}, warning = "";
const PAGE_SIZE = 60;
function render() {
  matches = pickerGoods(activeCatalog, { query: dialog.querySelector("#pickerSearch").value,
    type: dialog.querySelector("#pickerType").value, mod: dialog.querySelector("#pickerMod").value, source,
    productionOnly: dialog.querySelector("#pickerProduction").checked }, saved);
  page = Math.min(page, Math.max(0, Math.ceil(matches.length / PAGE_SIZE) - 1));
  const start = page * PAGE_SIZE, rows = matches.slice(start, start + PAGE_SIZE), grid = dialog.querySelector("#pickerGrid");
  grid.innerHTML = rows.map(good => `<button type="button" class="pickerGood" data-pick-good="${esc(good.id)}" title="${esc(good.name)} · ${esc(good.id)}"><span class="pickerIcon" aria-hidden="true"></span><span><b>${esc(good.name)}</b><small>${esc(good.mod || "Unknown mod")} · ${good.id.startsWith("f:") ? "Fluid" : "Item"}</small>${activeCatalog.matches(good.name).length > 1 ? `<small class="pickerIdentity">${esc(good.id)}</small>` : ""}</span></button>`).join("") || `<p class="atlasEmpty">${source === "favorites" ? "No matching favorites. Star useful items on their recipe page, or choose All items." : source === "recent" ? "No matching recent items. Choose All items to browse the recipe database." : "No matches in this GTNH version. Try fewer words or reset the filters."}</p>`;
  grid.querySelectorAll("[data-pick-good]").forEach(button => activeCatalog && window.GTNHNEI_ICON_API?.setIconByName(button.querySelector(".pickerIcon"), button.dataset.pickGood));
  dialog.querySelectorAll("[data-picker-source]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.pickerSource === source)));
  dialog.querySelector("#pickerPrevious").disabled = page === 0; dialog.querySelector("#pickerNext").disabled = start + PAGE_SIZE >= matches.length;
  dialog.querySelector("#pickerStatus").textContent = `${activeCatalog.dataset.label} · ${matches.length.toLocaleString("en")} match(es)${matches.length ? ` · ${start + 1}–${Math.min(start + PAGE_SIZE, matches.length)}` : ""}. ${warning}`;
}
function ensure() {
  if (dialog) return;
  dialog = createDialog("itemPickerDialog", "Choose from NEI", "Pick an icon or search part of a name. IDs and units are filled in for you.");
  dialog.querySelector(".atlasDialogBody").innerHTML = '<div class="pickerSearchBar"><label>Search items and fluids<input id="pickerSearch" type="search" autocomplete="off" placeholder="Partial name, @mod or item ID"></label><button id="pickerReset" type="button">Reset</button></div><nav class="atlasDialogTabs" aria-label="Item picker sources"><button type="button" data-picker-source="all">All items</button><button type="button" data-picker-source="favorites">★ Favorites</button><button type="button" data-picker-source="recent">Recent</button></nav><div class="pickerFilters"><label>Type<select id="pickerType"><option value="all">Items and fluids</option><option value="item">Items</option><option value="fluid">Fluids</option></select></label><label>Mod<select id="pickerMod"><option value="">All mods</option></select></label><label class="pickerCheck"><input id="pickerProduction" type="checkbox"> Has recipes</label></div><p id="pickerStatus" role="status" aria-live="polite"></p><div id="pickerGrid" class="pickerGrid" aria-label="Matching items and fluids"></div><div class="atlasDialogActions"><button type="button" id="pickerPrevious">Previous page</button><button type="button" id="pickerNext">Next page</button></div>';
  let timer;
  dialog.querySelector("#pickerSearch").addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(() => { page = 0; render(); }, 100); });
  dialog.addEventListener("change", event => {
    // A search input also emits change when it loses focus. Replacing result
    // buttons during pointerdown would swallow the user's selection click.
    if (!["pickerType", "pickerMod", "pickerProduction"].includes(event.target.id)) return;
    page = 0; render();
  });
  dialog.addEventListener("close", () => clearTimeout(timer));
  dialog.addEventListener("click", event => {
    const button = event.target.closest("button"); if (!button) return;
    if (button.dataset.pickGood) {
      const good = activeCatalog.resolve(button.dataset.pickGood); if (!good) return;
      try { new ItemLibrary(activeCatalog, localStorage).visit(good.id, "production"); } catch { /* Choosing an item works without storage. */ }
      dialog.close(); onSelect(good); return;
    }
    if (button.dataset.pickerSource) { source = button.dataset.pickerSource; page = 0; render(); }
    if (button.id === "pickerPrevious" || button.id === "pickerNext") { page += button.id === "pickerNext" ? 1 : -1; render(); dialog.querySelector("#pickerGrid button")?.focus(); }
    if (button.id === "pickerReset") { dialog.querySelector("#pickerSearch").value = ""; dialog.querySelector("#pickerType").value = "all"; dialog.querySelector("#pickerMod").value = ""; dialog.querySelector("#pickerProduction").checked = false; page = 0; source = "all"; render(); }
  });
  dialog.addEventListener("keydown", event => {
    // Search inputs consume the first Escape to clear their text in Chromium.
    // Keep the picker dismissal consistent whether search or an icon has focus.
    if (event.key === "Escape") { event.preventDefault(); dialog.close(); return; }
    const buttons = [...dialog.querySelectorAll("[data-pick-good]")], current = buttons.indexOf(event.target);
    if (event.target.id === "pickerSearch" && event.key === "ArrowDown") { event.preventDefault(); buttons[0]?.focus(); return; }
    if (current < 0 || !["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const columns = getComputedStyle(dialog.querySelector("#pickerGrid")).gridTemplateColumns.split(" ").length;
    const offset = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: columns, ArrowUp: -columns }[event.key];
    const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : Math.max(0, Math.min(buttons.length - 1, current + offset));
    buttons[next]?.focus();
  });
}
export function openItemPicker(catalog, select, { query = "" } = {}) {
  activeCatalog = catalog; onSelect = select; source = "all"; page = 0; warning = ""; saved = {};
  try { saved = new ItemLibrary(catalog, localStorage).read(); } catch { warning = "Saved items are unavailable; browsing still works."; }
  ensure();
  dialog.querySelector("#pickerSearch").value = catalog.resolve(query) ? "" : query;
  dialog.querySelector("#pickerType").value = "all"; dialog.querySelector("#pickerProduction").checked = false;
  const mods = dialog.querySelector("#pickerMod"); mods.innerHTML = '<option value="">All mods</option>';
  for (const mod of [...new Set(catalog.goods.map(good => good.mod).filter(Boolean))].sort()) { const option = document.createElement("option"); option.value = mod; option.textContent = mod; mods.appendChild(option); }
  render(); if (!dialog.open) dialog.showModal();
}
