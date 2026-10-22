import { openItemLibrary } from "./library-ui.js";
import { openOfflineManager } from "./offline-ui.js";
import { createDialog, notify } from "./ui-dialog.js";
import { checkOfflineUpdate } from "./offline.js";
import { getPreference, setPreference } from "./preferences.js";
import { createPopupMenu } from "./popup-menu.js";
import { installIntro, openAtlasIntro } from "./seo-intro-close.js";
import { openThemePicker } from "./theme-ui.js";
import { rotatingExamples, setRotatingExamples } from "./search-examples.js";

let help;
function populateVersions(body, menu) {
  const info = window.GTNH_DATASETS;
  body.replaceChildren();
  if (!info) body.textContent = "Recipe datasets are still loading.";
  else {
    for (const dataset of info.manifest.datasets) {
      const button = document.createElement("button"); button.type = "button"; button.className = "atlasVersionOption";
      const name = document.createElement("span"), note = document.createElement("small");
      name.textContent = `${dataset.id === info.active.id ? "✓ " : ""}${dataset.label}${dataset.available ? "" : " — unavailable"}`;
      note.textContent = dataset.reason || (dataset.id === info.active.id ? "Current recipe dataset" : "Recipes, icons and saved plans for this version");
      button.append(name, note);
      button.disabled = !dataset.available; button.title = dataset.reason || dataset.verification;
      button.setAttribute("role", "menuitemradio");
      button.setAttribute("aria-checked", String(dataset.id === info.active.id));
      button.addEventListener("click", () => { menu.close(true); if (dataset.id !== info.active.id) info.select(dataset.id); });
      body.appendChild(button);
    }
    const source = document.createElement("a"); source.href = info.active.source; source.textContent = "View dataset source"; source.role = "menuitem"; body.appendChild(source);
  }
}
function showHelp() {
  if (!help) {
    help = createDialog("gtnhHelpOverlay", "Use Atlas", "Search recipes, plan a factory, and keep your work with its recipe version.");
    help.querySelector(".atlasDialogBody").innerHTML = `<div class="atlasHelpGrid"><section><h3>Recipe search</h3><p>Tap an item for recipes. Double tap or right click for usages. Hold to copy its name.</p><p>Search words, <code>@greg</code> for a mod, or an exact item/fluid ID. Search filters select items, fluids, mods and sorting.</p></section><section><h3>Production Calculator</h3><p>Build material and machine requirements for one product or a factory with several outputs. Set total quantities or rates, choose routes, record stock, and check power and bottlenecks.</p><p>Open a recipe and choose <b>Plan</b>, or use <b>Calculator</b> in the toolbar. Basic and Factory modes share one plan. Named plans and shareable links are under Saved plans and sharing.</p></section><section><h3>Calculator and diagrams</h3><p>Basic mode starts with one product; Factory adds outputs, stock and machine settings. Both include dependency trees, diagrams and SVG download. The gtnh-flow solver is under Export and loads its external runtime when requested.</p></section><section><h3>Keep useful items</h3><p>Star a recipe to favorite its exact item. Library includes favorites, recent history and portable JSON backups. Each GTNH version has its own library.</p></section><section><h3>Keyboard shortcuts</h3><p><kbd>/</kbd> Search · <kbd>P</kbd> Calculator · <kbd>L</kbd> Library · <kbd>?</kbd> Help.</p><p>Focus a grid item: arrows move, <kbd>R</kbd> shows recipes, <kbd>U</kbd> shows usages, <kbd>F</kbd> toggles its favorite.</p></section><section><h3>Offline and updates</h3><p>Verified recipe data is cached for faster return visits. Choose More → Offline to save the app and matching icons for a complete version. Basic search, planning and saved work then run without a connection. The external flow solver still needs a connection.</p></section></div><p class="atlasMuted">Atlas reports assumptions and unresolved inputs in each plan. Machine reference models cover their documented GT5 formulas; check specialized multiblocks and recipe conditions in game.</p>`;
  }
  if (!help.querySelector("#helpEveryVisit")) {
    const label = document.createElement("label"); label.className = "helpPreference";
    label.innerHTML = '<input type="checkbox" id="helpEveryVisit"> Show help on every visit';
    help.querySelector(".atlasDialogBody").appendChild(label);
    label.querySelector("input").addEventListener("change", event => setPreference("gtnhnei_help_seen", event.target.checked ? "always" : "1"));
  }
  help.querySelector("#helpEveryVisit").checked = getPreference("gtnhnei_help_seen") === "always";
  help.showModal();
}
function install() {
  const strip = document.createElement("nav"); strip.id = "gtnhToolStrip"; strip.className = "gtnhToolStrip"; strip.setAttribute("aria-label", "GTNH Atlas tools");
  strip.innerHTML = '<button id="toolNei" type="button" title="Select recipe version"><span id="toolDb">Version</span> ▾</button><button id="toolCalc" type="button" title="Production Calculator (P)">Calculator</button><button id="toolFav" type="button" aria-haspopup="dialog" title="Favorites and recent items (L)">Library</button><button id="toolMore" type="button" aria-label="More tools" title="More tools">⋯</button>';
  document.querySelector(".app").prepend(strip);
  createPopupMenu(document.getElementById("toolNei"), { id: "gtnhNeiDrop", label: "Recipe version", populate: populateVersions });
  const moreButton = document.getElementById("toolMore");
  const more = createPopupMenu(moreButton, { id: "atlasToolsMenu", label: "More tools" });
  more.element.innerHTML = '<button id="toolTheme" type="button" role="menuitem" aria-haspopup="dialog">Theme</button><button id="toolOffline" type="button" role="menuitem" aria-haspopup="dialog">Offline</button><button id="toolHelp" type="button" role="menuitem" aria-haspopup="dialog" title="Help (?)">Help &amp; shortcuts</button><button id="gtfbOpen" type="button" role="menuitem" aria-haspopup="dialog">Feedback</button><button id="toolAbout" type="button" role="menuitem" aria-controls="seoIntro">About Atlas</button>';
  more.element.addEventListener("click", event => {
    const button = event.target.closest("button"); if (!button) return;
    more.close(true);
    if (button.id === "toolTheme") openThemePicker();
    if (button.id === "toolSearchExamples") { setRotatingExamples(!rotatingExamples()); updateExamples(); }
    if (button.id === "toolOffline") openOfflineManager();
    if (button.id === "toolHelp") showHelp();
    if (button.id === "gtfbOpen") { if (window.GTNH_FEEDBACK) window.GTNH_FEEDBACK.open(); else notify("Feedback is still loading. Try again shortly."); }
    if (button.id === "toolAbout") openAtlasIntro(moreButton);
  });
  const examples = document.createElement("button"); examples.id = "toolSearchExamples"; examples.type = "button"; examples.setAttribute("role", "menuitemcheckbox");
  const updateExamples = () => { examples.textContent = "Rotating search examples"; examples.setAttribute("aria-checked", String(rotatingExamples())); };
  updateExamples(); more.element.querySelector("#toolTheme").after(examples);
  const updateTheme = () => {
    const api = window.GTNH_THEME, theme = api?.themes.find(entry => entry.id === api.current);
    if (theme) document.getElementById("toolTheme").textContent = `Theme · ${theme.label}`;
  };
  window.addEventListener("atlas-theme-changed", updateTheme); updateTheme();
  installIntro();
  document.getElementById("toolCalc").addEventListener("click", () => { if (window.GTNH_CALC) window.GTNH_CALC.open(); else notify("Planner is loading."); });
  document.getElementById("toolFav").addEventListener("click", () => openItemLibrary());
  const updateDataset = () => {
    const dataset = window.GTNH_DATASETS?.active;
    if (dataset) { const badge = document.getElementById("toolDb"); badge.textContent = dataset.label; document.getElementById("toolNei").setAttribute("aria-label", `Recipe version: ${dataset.label}`); badge.title = dataset.verification; }
  };
  window.addEventListener("gtnh-dataset-selected", updateDataset); updateDataset();
  checkOfflineUpdate(() => { const button = document.getElementById("toolOffline"); button.textContent = "Offline · update ready"; moreButton.classList.add("workspaceUpdate"); moreButton.setAttribute("aria-label", "More tools · update ready"); }).catch(() => {});
  if (getPreference("gtnhnei_help_seen") === "always") setTimeout(showHelp, 550);
  document.addEventListener("keydown", event => {
    if (event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey || event.target.closest("input, textarea, select, [contenteditable], dialog, [role=dialog], [role=menu]") || document.querySelector("dialog[open], #gtnhCalcOverlay.show, #gtnhMatCalcOverlay.show")) return;
    const key = event.key.toLowerCase();
    if (key === "p") { event.preventDefault(); document.getElementById("toolCalc").click(); }
    if (key === "l") { event.preventDefault(); openItemLibrary(); }
    if (key === "?") { event.preventDefault(); showHelp(); }
  });
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install); else install();
