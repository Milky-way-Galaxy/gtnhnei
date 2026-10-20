import { ItemLibrary } from "./item-library.js";
import { createDialog, escapeHtml as esc, notify, downloadText } from "./ui-dialog.js";
let dialog, tab = "favorites", visible = 60, matches = [];
const library = () => {
  if (!window.GTNH_CATALOG) throw new Error("Recipe data is still loading.");
  return new ItemLibrary(window.GTNH_CATALOG, localStorage);
};
function changed() {
  window.dispatchEvent(new Event("gtnh-library-changed"));
  if (dialog?.open) render();
}
export function recordVisit(id, mode) {
  try { library().visit(id, mode); } catch { /* Recipe navigation works when storage is blocked or damaged. */ }
}
export function isFavorite(id) {
  try { return library().read().favorites.some(entry => entry.id === id); } catch { return false; }
}
export function toggleFavorite(id) {
  try { const added = library().toggle(id); changed(); notify(added ? "Saved to favorites." : "Removed from favorites."); return added; }
  catch (error) { notify(error.message); return false; }
}
function render() {
  const list = dialog.querySelector("#itemLibraryList"), status = dialog.querySelector("#itemLibraryStatus");
  dialog.querySelectorAll("[data-library-tab]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.libraryTab === tab)));
  dialog.querySelector("#libraryClearRecent").hidden = tab !== "recent";
  try {
    const data = library().read(), query = dialog.querySelector("#libraryFilter").value.trim().toLowerCase();
    const favorites = new Set(data.favorites.map(entry => entry.id));
    const entries = data[tab].filter(entry => `${entry.name} ${entry.id || ""}`.toLowerCase().includes(query));
    list.innerHTML = entries.slice(0, visible).map((entry, index) => {
      const good = entry.id ? window.GTNH_CATALOG.resolve(entry.id) : null;
      return `<article class="libraryRow" data-library-index="${index}"><span class="libraryIcon" aria-hidden="true"></span><div class="libraryGood"><b>${esc(good?.name || entry.name)}</b><small>${esc(entry.id || "Legacy name — choose an exact item below to save it with an ID")}</small>${entry.id && !good ? "<small>Absent from the active dataset; entry retained.</small>" : ""}</div><div class="libraryActions"><button type="button" data-library-action="production" ${good ? "" : "disabled"}>Recipe</button><button type="button" data-library-action="usage" ${good ? "" : "disabled"}>Usage</button><button type="button" data-library-action="plan" ${good ? "" : "disabled"}>Plan</button><button type="button" data-library-action="favorite" ${good ? "" : "disabled"} aria-label="${favorites.has(entry.id) ? "Unfavorite" : "Favorite"} ${esc(entry.name)}" aria-pressed="${favorites.has(entry.id)}">${favorites.has(entry.id) ? "★" : "☆"}</button>${tab === "favorites" ? '<button type="button" data-library-action="remove">Remove</button>' : ""}</div></article>`;
    }).join("") || `<p class="atlasEmpty">${query ? "No saved items match this filter." : tab === "recent" ? "Open a recipe or usage to start your recent history." : "Save items with the star beside a recipe name, or search for one below."}</p>`;
    list.querySelectorAll(".libraryRow").forEach((row, index) => {
      const entry = entries[index];
      if (entry.id) window.GTNHNEI_ICON_API?.setIconByName(row.querySelector(".libraryIcon"), entry.id);
      row.querySelectorAll("[data-library-action]").forEach(button => button.addEventListener("click", () => {
        const action = button.dataset.libraryAction;
        if (action === "favorite") { toggleFavorite(entry.id); return; }
        if (action === "remove") { try { library().remove(entry.id, entry.name); changed(); } catch (error) { status.textContent = error.message; } return; }
        dialog.close();
        if (action === "plan") window.GTNH_CALC?.planItem(entry.id);
        else window.GTNHNEI_MAIN_API?.[action === "usage" ? "usage" : "recipe"](entry.id);
      }));
    });
    dialog.querySelector("#libraryMore").hidden = entries.length <= visible;
    status.textContent = `${window.GTNH_CATALOG.dataset.label} · ${data.favorites.length} favorites · ${data.recent.length} recent items. Stored on this browser.`;
  } catch (error) { list.replaceChildren(); status.textContent = error.message; }
}
function searchGoods() {
  const query = dialog.querySelector("#libraryGoodSearch").value.trim().toLowerCase(), catalog = window.GTNH_CATALOG;
  matches = [];
  if (query.length >= 2) {
    const exact = catalog.resolve(dialog.querySelector("#libraryGoodSearch").value.trim());
    if (exact && /^[if]:/.test(exact.id)) matches.push(exact);
    for (const good of catalog.goods) {
      if (matches.length >= 20) break;
      if (!matches.includes(good) && `${good.name} ${good.id}`.toLowerCase().includes(query)) matches.push(good);
    }
  }
  const results = dialog.querySelector("#librarySearchResults");
  results.innerHTML = matches.map((good, i) => `<button type="button" data-library-add="${i}"><b>${esc(good.name)}</b><small>${esc(good.id)}</small></button>`).join("") || (query.length >= 2 ? "<p>No exact items found in this dataset.</p>" : "");
}
export function openItemLibrary(initialTab = "favorites") {
  if (!window.GTNH_CATALOG) { notify("Recipe data is still loading."); return; }
  if (!dialog) {
    dialog = createDialog("itemLibraryDialog", "Item library", "Favorites and recently viewed items stay with their GTNH version.");
    dialog.querySelector(".atlasDialogBody").innerHTML = '<nav class="atlasDialogTabs" aria-label="Item library views"><button type="button" data-library-tab="favorites">★ Favorites</button><button type="button" data-library-tab="recent">Recent</button></nav><label>Filter saved items<input id="libraryFilter" type="search" placeholder="Name or ID"></label><div id="itemLibraryList"></div><button id="libraryMore" type="button" hidden>Show more saved items</button><details class="librarySearch"><summary>Add an item or fluid</summary><label>Find an exact item<input id="libraryGoodSearch" type="search" autocomplete="off" placeholder="Type at least two characters"></label><div id="librarySearchResults"></div></details><div class="atlasDialogActions"><button type="button" id="libraryExport">Export library / backup</button><label class="atlasImport">Import library<input id="libraryImport" type="file" accept=".json,application/json"></label><button id="libraryClearRecent" type="button" hidden>Clear recent history</button></div><p id="itemLibraryStatus" role="status" aria-live="polite"></p>';
    dialog.addEventListener("click", event => {
      const button = event.target.closest("button"); if (!button) return;
      if (button.dataset.libraryTab) { tab = button.dataset.libraryTab; visible = 60; render(); }
      if (button.dataset.libraryAdd !== undefined) { toggleFavorite(matches[Number(button.dataset.libraryAdd)].id); render(); }
      if (button.id === "libraryMore") { visible += 60; render(); }
      if (button.id === "libraryClearRecent") { try { library().clearRecent(); render(); } catch (error) { notify(error.message); } }
      if (button.id === "libraryExport") { try { downloadText("gtnh-atlas-item-library.json", library().rawBackup()); } catch (error) { notify(error.message); } }
    });
    dialog.querySelector("#libraryFilter").addEventListener("input", () => { visible = 60; render(); });
    let searchTimer;
    dialog.querySelector("#libraryGoodSearch").addEventListener("input", () => { clearTimeout(searchTimer); searchTimer = setTimeout(searchGoods, 100); });
    dialog.querySelector("#libraryImport").addEventListener("change", async event => {
      try {
        const file = event.target.files[0]; if (!file) return;
        if (file.size > 2_000_000) throw new Error("Item library file exceeds 2 MB.");
        library().import(await file.text()); changed(); notify("Imported favorites and history into this version's library.");
      } catch (error) { dialog.querySelector("#itemLibraryStatus").textContent = error.message; }
      event.target.value = "";
    });
  }
  tab = initialTab; visible = 60; render(); if (!dialog.open) dialog.showModal();
}
window.addEventListener("storage", event => { if (event.key?.startsWith("gtnh_atlas_item_library_v1_")) changed(); });
