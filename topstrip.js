import { openItemLibrary } from "./library-ui.js";
import { openOfflineManager } from "./offline-ui.js";
import { createDialog, notify } from "./ui-dialog.js";
import { checkOfflineUpdate } from "./offline.js";

let versionDialog, help;
function openVersionPicker() {
  if (!versionDialog) versionDialog = createDialog("gtnhNeiDrop", "Recipe version", "Recipes, icons, saved plans and item libraries stay with their version.");
  const body = versionDialog.querySelector(".atlasDialogBody"), info = window.GTNH_DATASETS;
  body.replaceChildren();
  if (!info) body.textContent = "Recipe datasets are still loading.";
  else {
    for (const dataset of info.manifest.datasets) {
      const button = document.createElement("button"); button.type = "button"; button.className = "atlasVersionOption";
      button.textContent = `${dataset.id === info.active.id ? "✓ " : ""}${dataset.label}${dataset.available ? "" : " — unavailable"}`;
      button.disabled = !dataset.available; button.title = dataset.reason || dataset.verification;
      button.setAttribute("aria-pressed", String(dataset.id === info.active.id));
      button.addEventListener("click", () => { if (dataset.id !== info.active.id) info.select(dataset.id); versionDialog.close(); });
      body.appendChild(button);
      const note = document.createElement("p"); note.className = "atlasMuted"; note.textContent = dataset.reason || dataset.verification; body.appendChild(note);
    }
    const source = document.createElement("a"); source.href = info.active.source; source.textContent = "View the active dataset's pinned upstream source"; body.appendChild(source);
  }
  versionDialog.showModal();
}
function showHelp() {
  if (!help) {
    help = createDialog("gtnhHelpOverlay", "Use Atlas", "Search recipes, plan a factory, and keep your work with its recipe version.");
    help.querySelector(".atlasDialogBody").innerHTML = `<div class="atlasHelpGrid"><section><h3>Recipe search</h3><p>Tap an item for recipes. Double tap or right click for usages. Hold to copy its name.</p><p>Search words, <code>@greg</code> for a mod, or an exact item/fluid ID. Search filters select items, fluids, mods and sorting.</p></section><section><h3>Production Planner</h3><p>Build material and machine requirements for one product or a factory with several outputs. Set total quantities or rates, choose routes, record stock, and check power and bottlenecks.</p><p>Open a recipe and choose <b>Plan this</b>, or use <b>Planner</b> in the toolbar. Named plans and shareable links are under Saved plans and sharing.</p></section><section><h3>Calculator and diagrams</h3><p>Calculator offers a simpler material breakdown. Planner includes a dependency tree and SVG download. The gtnh-flow solver is under Code / Export and loads its external runtime when requested.</p></section><section><h3>Keep useful items</h3><p>Star a recipe to favorite its exact item. Library includes favorites, recent history and portable JSON backups. Each GTNH version has its own library.</p></section><section><h3>Keyboard shortcuts</h3><p><kbd>/</kbd> Search · <kbd>P</kbd> Planner · <kbd>L</kbd> Library · <kbd>?</kbd> Help.</p><p>Focus a grid item: arrows move, <kbd>R</kbd> shows recipes, <kbd>U</kbd> shows usages, <kbd>F</kbd> toggles its favorite.</p></section><section><h3>Offline and updates</h3><p>Verified recipe data is cached for faster return visits. Choose Offline to save the app and matching icons for a complete version. Basic search, planning and saved work then run without a connection. The external flow solver still needs a connection.</p></section></div><p class="atlasMuted">Atlas reports assumptions and unresolved inputs in each plan. Machine reference models cover their documented GT5 formulas; check specialized multiblocks and recipe conditions in game.</p>`;
  }
  help.showModal();
}
function install() {
  const strip = document.createElement("nav"); strip.id = "gtnhToolStrip"; strip.className = "gtnhToolStrip"; strip.setAttribute("aria-label", "GTNH Atlas tools");
  strip.innerHTML = '<button id="toolNei" type="button" aria-haspopup="dialog">Version ▾</button><button id="toolCalc" class="workspacePrimary" type="button" title="Production Planner (P)">Planner</button><button id="toolMatCalc" type="button">Calculator</button><button id="toolFav" type="button" aria-haspopup="dialog" title="Favorites and recent items (L)">Library</button><button id="toolOffline" type="button" aria-haspopup="dialog">Offline</button><button id="toolHelp" type="button" aria-haspopup="dialog" title="Help (?)">Help</button><span id="toolDb" class="gtnhDbBadge">Loading recipes…</span>';
  document.querySelector(".app").prepend(strip);
  document.getElementById("toolNei").addEventListener("click", openVersionPicker);
  document.getElementById("toolCalc").addEventListener("click", () => { if (window.GTNH_CALC) window.GTNH_CALC.open(); else notify("Planner is loading."); });
  document.getElementById("toolMatCalc").addEventListener("click", () => { if (window.GTNH_MATCALC) window.GTNH_MATCALC.open(); else notify("Calculator is loading."); });
  document.getElementById("toolFav").addEventListener("click", () => openItemLibrary());
  document.getElementById("toolOffline").addEventListener("click", openOfflineManager);
  document.getElementById("toolHelp").addEventListener("click", showHelp);
  const updateDataset = () => {
    const dataset = window.GTNH_DATASETS?.active;
    if (dataset) { const badge = document.getElementById("toolDb"); badge.textContent = dataset.label; badge.title = dataset.verification; }
  };
  window.addEventListener("gtnh-dataset-selected", updateDataset); updateDataset();
  checkOfflineUpdate(() => { const button = document.getElementById("toolOffline"); button.textContent = "Update ready"; button.classList.add("workspaceUpdate"); }).catch(() => {});
  document.addEventListener("keydown", event => {
    if (event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey || event.target.closest("input, textarea, select, [contenteditable], dialog, [role=dialog]") || document.querySelector("dialog[open], #gtnhCalcOverlay.show, #gtnhMatCalcOverlay.show")) return;
    const key = event.key.toLowerCase();
    if (key === "p") { event.preventDefault(); document.getElementById("toolCalc").click(); }
    if (key === "l") { event.preventDefault(); openItemLibrary(); }
    if (key === "?") { event.preventDefault(); showHelp(); }
  });
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install); else install();
