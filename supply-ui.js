import { buildSupplyPlan, supplyCsv } from "./supply-plan.js";
import { createDialog, escapeHtml as esc, notify, downloadText } from "./ui-dialog.js";
const fmt = value => new Intl.NumberFormat("en", { maximumSignificantDigits: 9 }).format(value);
const packing = row => row.packing?.buckets !== undefined ? `${fmt(row.packing.buckets)} buckets` : row.packing?.stackSize ? `${fmt(row.packing.stacks)} full stacks + ${fmt(row.packing.remainder)} items · ${row.packing.stackSize}/stack` : "Native stack size unavailable";
export function createSupplyTools({ catalog, getPlan, getState, update }) {
  let dialog, supply, showUnprepared = false, storageWarning = false;
  function persist(values) { if (update(values) === false) storageWarning = true; }
  function actions(enabled) { for (const id of ["supplyCsv", "supplyPrint"]) dialog.querySelector(`#${id}`).disabled = !enabled; }
  function project() {
    const state = getState();
    return buildSupplyPlan(getPlan(), { seconds: state.operatingSeconds, basis: state.operatingBasis, checks: state.checklist }, catalog());
  }
  function rows(entries, checkable = true) {
    return entries.length ? entries.map(row => `<article class="supplyRow ${row.checked ? "supplyPrepared" : ""}" data-supply-row="${esc(row.key)}">${checkable ? `<label><input type="checkbox" data-supply-check="${esc(row.key)}" ${row.checked ? "checked" : ""} aria-label="Prepared: ${esc(row.name)}"><span><b>${esc(row.name)}</b><small>${esc(row.id)}</small></span></label>` : `<div><b>${esc(row.name)}</b><small>${esc(row.id)}</small></div>`}<div class="supplyAmount"><b>${fmt(row.amount)} ${esc(row.unit)}</b><small>${esc(packing(row))}</small></div></article>`).join("") : '<p class="atlasMuted">None.</p>';
  }
  function render() {
    try {
      supply = project();
      const filtered = entries => showUnprepared ? entries.filter(row => !row.checked) : entries;
      dialog.querySelector("#supplyResults").hidden = false;
      dialog.querySelector("#supplyControls").hidden = !supply.isRate;
      dialog.querySelector("#supplyHours").value = getState().operatingSeconds / 3600;
      dialog.querySelector("#supplyBasis").value = getState().operatingBasis;
      dialog.querySelector("#supplyResults").innerHTML = `<p class="supplyDataset">${esc(supply.dataset.label || supply.dataset.id)} · ${supply.isRate ? `${fmt(supply.seconds / 3600)} hour(s) · ${supply.basis === "installed" ? `${fmt(supply.factor * 100)}% of requested mix (known-stage ceiling)` : "requested output mix"}` : "total craft quantities"}</p><div class="supplySummary"><div>Known energy${supply.partial ? " (partial)" : ""}<b>${fmt(supply.knownEnergy)} EU</b></div><div>Expected output${supply.outputs.length > 1 ? "s" : ""}<b>${supply.outputs.map(output => `${esc(output.name)}: ${fmt(output.amount)} ${esc(output.unit)}`).join("<br>")}</b></div></div>${supply.capacityPartial ? '<p class="plannerCapacityWarning">Some stages or routes are unresolved. The ceiling is a bound from known stages.</p>' : ""}<h3>Consumed / supplied inputs</h3>${rows(filtered(supply.consumption))}<h3>Reusable startup stock</h3><p class="atlasMuted">For the configured machine pools. Not multiplied by operating time.</p>${rows(filtered(supply.startup))}<details><summary>Surplus and byproducts</summary>${rows(supply.surplus, false)}</details><ul class="supplyNotes">${supply.notes.map(note => `<li>${esc(note)}</li>`).join("")}</ul>`;
      dialog.querySelector("#supplyProgress").textContent = `${supply.completed} of ${supply.total} supply entries prepared. Checks track gathering only; recipe quantities and inventory are unchanged.`;
      dialog.querySelector("#supplyStatus").textContent = storageWarning ? "Browser storage is unavailable. Export the plan JSON to preserve its checklist." : "";
    } catch (error) { supply = null; dialog.querySelector("#supplyResults").hidden = true; dialog.querySelector("#supplyStatus").textContent = error.message; }
    actions(!!supply);
  }
  function ensure() {
    if (dialog) return;
    dialog = createDialog("supplyDialog", "Supplies & build checklist", "Turn a production plan into a practical gathering list.");
    dialog.querySelector(".atlasDialogBody").innerHTML = '<div id="supplyControls" class="supplyControls" data-no-print><label>Run duration (hours)<input id="supplyHours" type="number" min="0.000277777777777778" max="8760" step="any"></label><label>Operating rate<select id="supplyBasis"><option value="requested">Requested output mix</option><option value="installed">Known-stage installed capacity ceiling</option></select></label></div><p id="supplyProgress" role="status" aria-live="polite"></p><label class="supplyFilter" data-no-print><input type="checkbox" id="supplyUnprepared"> Show unprepared entries only</label><div id="supplyResults"></div><div class="atlasDialogActions" data-no-print><button type="button" id="supplyCsv">Download supplies CSV</button><button type="button" id="supplyPrint">Print checklist</button><button type="button" id="supplyReset">Clear preparation checks</button></div><p id="supplyStatus" role="status" aria-live="polite"></p>';
    dialog.addEventListener("change", event => {
      const input = event.target;
      if (input.id === "supplyHours") {
        const seconds = Number(input.value) * 3600;
        if (!input.value || !Number.isFinite(seconds) || seconds < 1 || seconds > 31536000) { supply = null; actions(false); dialog.querySelector("#supplyResults").hidden = true; dialog.querySelector("#supplyStatus").textContent = "Enter an operating duration from one second to one year."; return; }
        persist({ operatingSeconds: seconds }); render();
      } else if (input.id === "supplyBasis") { persist({ operatingBasis: input.value }); render(); }
      else if (input.id === "supplyUnprepared") { showUnprepared = input.checked; render(); }
      else if (input.dataset.supplyCheck && supply) {
        const key = input.dataset.supplyCheck, row = [...supply.consumption, ...supply.startup].find(row => row.key === key);
        if (!row) return;
        const checklist = { ...getState().checklist };
        if (input.checked) checklist[key] = row.amount; else delete checklist[key];
        persist({ checklist });
        if (showUnprepared) render();
        else {
          input.closest(".supplyRow").classList.toggle("supplyPrepared", input.checked);
          supply = project(); dialog.querySelector("#supplyProgress").textContent = `${supply.completed} of ${supply.total} supply entries prepared. Checks track gathering only; recipe quantities and inventory are unchanged.`;
          if (storageWarning) dialog.querySelector("#supplyStatus").textContent = "Browser storage is unavailable. Export the plan JSON to preserve its checklist.";
        }
      }
    });
    dialog.addEventListener("click", event => {
      const id = event.target.closest("button")?.id;
      if (id === "supplyReset") { persist({ checklist: {} }); render(); }
      if (id === "supplyCsv" && supply) downloadText("gtnh-atlas-supplies.csv", supplyCsv(supply), "text/csv");
      if (id === "supplyPrint" && supply) {
        document.body.classList.add("atlasPrintingSupplies");
        try { window.print(); } finally { document.body.classList.remove("atlasPrintingSupplies"); }
      }
    });
  }
  return { open() { if (!getPlan()) { notify("Build a production plan first."); return; } ensure(); render(); if (!dialog.open) dialog.showModal(); } };
}
