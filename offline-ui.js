import { offlineStatus, saveOffline, removeOfflineDataset, disableOffline, applyOfflineUpdate } from "./offline.js";
import { databaseCache } from "./database-cache.js";
import { createDialog, escapeHtml as esc } from "./ui-dialog.js";
let dialog, busy = false;
const statusText = text => { if (dialog) dialog.querySelector("#offlineStatus").textContent = text; };
async function render() {
  const dataset = window.GTNH_DATASETS?.active;
  if (!dataset) { statusText("Recipe versions are still loading."); return; }
  try {
    const status = await offlineStatus(dataset), records = await databaseCache.list().catch(() => []);
    dialog.querySelector("#offlineDetails").innerHTML = `<p><b>${esc(dataset.label)}</b></p><ul class="offlineChecks"><li>${status.app ? "✓" : "○"} Application saved</li><li>${status.recipes ? "✓" : "○"} Verified recipe data ${status.recipes ? `(${(status.recipes.bytes / 1000000).toFixed(1)} MB)` : "not saved"}</li><li>${status.icons ? "✓ Matching icons saved" : "○ Matching icons not saved"}</li></ul><p>${status.app && status.recipes && status.icons ? "This version is ready for offline search and production planning." : "Choose Save version offline while connected to prepare the application, recipes and icons."}</p><p class="atlasMuted">${records.length} recipe version(s) cached, ${(records.reduce((sum, record) => sum + record.bytes, 0) / 1000000).toFixed(1)} MB of decompressed data. Icons use additional storage. Your browser may evict offline data when storage is low.</p>`;
    dialog.querySelector("#offlineUpdate").hidden = !status.update;
    dialog.querySelector("#offlineSave").disabled = busy || !window.GTNH_CATALOG;
    dialog.querySelector("#offlineRemove").disabled = dialog.querySelector("#offlineDisable").disabled = busy;
  } catch (error) { statusText(error.message); }
}
export function openOfflineManager() {
  if (!dialog) {
    dialog = createDialog("offlineDialog", "Offline & storage", "Keep a verified recipe version available when your connection is unreliable.");
    dialog.querySelector(".atlasDialogBody").innerHTML = '<div id="offlineDetails"></div><div class="atlasDialogActions"><button id="offlineSave" type="button">Save active version offline</button><button id="offlineUpdate" type="button" hidden>Apply app update and reload</button><button id="offlineRemove" type="button">Remove active version downloads</button><button id="offlineDisable" type="button">Disable offline app</button></div><p>Recipe data is cached automatically after a successful load to skip future downloads and decompression. Offline mode additionally saves the application and this version’s verified icons. External Pyodide/Viz flow solving requires a connection.</p><p>Removing downloads affects disposable data only. Favorites, plans, route choices and inventory remain saved. Disabling the offline app takes full effect on the next visit.</p><p id="offlineStatus" role="status" aria-live="polite"></p>';
    dialog.addEventListener("click", async event => {
      const id = event.target.closest("button")?.id;
      if (!["offlineSave", "offlineRemove", "offlineDisable", "offlineUpdate"].includes(id) || busy) return;
      busy = true; await render();
      try {
        if (id === "offlineSave") { await saveOffline(window.GTNH_DATASETS.active, statusText); statusText("Saved. You can reload this version without a connection."); }
        if (id === "offlineRemove") { await removeOfflineDataset(window.GTNH_DATASETS.active); statusText("Active version downloads removed. Saved plans and item library were retained."); }
        if (id === "offlineDisable") { await disableOffline(); statusText("Offline application disabled. Reload while connected to load the current public app."); }
        if (id === "offlineUpdate") { if (!await applyOfflineUpdate()) statusText("No waiting application update was found."); }
      } catch (error) { statusText(`Could not finish: ${error.message} You can retry.`); }
      finally { busy = false; await render(); }
    });
  }
  if (!dialog.open) dialog.showModal(); render();
}
