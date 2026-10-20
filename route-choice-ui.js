import { describeRouteChoices, filterRouteChoices } from "./route-choices.js";
import { voltageTiers, tierVoltages } from "./machine-model.js";
import { recipeMetadataRows } from "./recipe-details.js";
import { createDialog, escapeHtml as esc } from "./ui-dialog.js";
let dialog, context, visible = 20, sequence = 0;
const fmt = value => value === null || value === undefined ? "unknown" : new Intl.NumberFormat("en", { maximumSignificantDigits: 7 }).format(value);
function render() {
  if (!context) return;
  const max = dialog.querySelector("#routeMaximumVoltage").value;
  const rows = filterRouteChoices(context.rows, { machine: dialog.querySelector("#routeMachineFilter").value, query: dialog.querySelector("#routeTextFilter").value,
    maxVoltage: max === "" ? null : Number(max), sort: dialog.querySelector("#routeOrdering").value });
  context.filtered = rows;
  const unit = context.catalog.describe(context.good).unit === "L" ? "L" : "item";
  dialog.querySelector("#routeChoicesStatus").textContent = `${rows.length} of ${context.rows.length} routes · ${context.catalog.dataset.label}. Showing ${Math.min(visible, rows.length)}.`;
  dialog.querySelector("#routeChoiceRows").innerHTML = rows.slice(0, visible).map((row, index) => {
    const { recipe, metrics, balance } = row, selected = recipe.id === context.selected, metadata = recipeMetadataRows(recipe);
    const goods = (title, values) => `<section><h4>${title}</h4>${values.length ? `<ul>${values.map(io => `<li>${fmt(io.amount)} ${esc(io.unit)} ${esc(io.name)}<small>${esc(io.id)}</small></li>`).join("")}</ul>` : "<p>None.</p>"}</section>`;
    return `<article class="routeChoice" data-route-recipe="${esc(recipe.id)}" ${selected ? 'data-selected="true"' : ""}><header><div><h3>${esc(recipe.machine)} <small>${esc(recipe.tier || "power unknown")}${selected ? " · current route" : ""}</small></h3><small>${esc(recipe.id)}</small></div><button type="button" data-pick-route="${index}" ${row.valid ? "" : "disabled"}>${selected ? "Keep this route" : "Use this route"}</button></header><div class="routeMetrics"><div>EU/${unit}<b>${fmt(metrics.energyPerOutput)}</b></div><div>${unit}/s<b>${fmt(metrics.outputPerSecond)}</b></div><div>Net yield/batch<b>${fmt(metrics.output)} ${unit}</b></div><div>Recipe power<b>${fmt(recipe.eut)} EU/t</b></div></div><p>${fmt(recipe.durationTicks === null ? null : recipe.durationTicks / 20)} s/batch · ${fmt(recipe.voltage)} V × ${fmt(recipe.amperage)} A${metrics.expected ? " · expected chance yield" : ""}${row.valid ? "" : " · no positive net target output"}</p><details><summary>Inputs, outputs & conditions</summary><div class="routeIngredients">${goods("Net consumed inputs / batch", balance.inputs)}${goods("Net outputs / batch", balance.outputs)}${goods("Reusable startup stock", balance.reusable)}</div>${metadata.length ? `<dl>${metadata.map(item => `<dt>${esc(item.key)}</dt><dd>${esc(item.value)}</dd>`).join("")}</dl>` : ""}<p class="atlasMuted">Machine availability: ${esc(recipe.crafters?.map(crafter => crafter.name).join(", ") || "not supplied by this export")}. Verify specialized machine and recipe conditions in game.</p></details></article>`;
  }).join("") || '<p class="atlasEmpty">No routes match these filters. Try a higher voltage or clear the machine/search filters.</p>';
  dialog.querySelector("#routeChoicesMore").hidden = visible >= rows.length;
}
function ensure() {
  if (dialog) return;
  dialog = createDialog("routeChoiceDialog", "Compare production routes", "Base recipe step values per unit of net target output. Input-production costs and custom machine profiles are covered by the built plan.");
  dialog.querySelector(".atlasDialogBody").innerHTML = `<p id="routeChoiceGood"></p><div class="routeChoiceFilters"><label>Search machine, ingredient or recipe ID<input id="routeTextFilter" type="search"></label><label>Machine<select id="routeMachineFilter"><option value="">All machines</option></select></label><label>Order by<select id="routeOrdering"><option value="energy">Lowest EU per net output</option><option value="speed">Fastest net output</option><option value="voltage">Lowest recipe voltage</option><option value="yield">Largest net yield per batch</option><option value="machine">Machine name</option></select></label><label>Maximum recipe voltage<select id="routeMaximumVoltage"><option value="">Any / unknown</option>${voltageTiers.map((tier, i) => `<option value="${tierVoltages[i]}">${tier} · ${fmt(tierVoltages[i])} V</option>`).join("")}</select></label></div><p class="atlasMuted">Voltage filtering excludes recipes whose exported power is unknown. Chance outputs use expected values.</p><p id="routeChoicesStatus" role="status" aria-live="polite"></p><div id="routeChoiceRows"></div><button type="button" id="routeChoicesMore" hidden>Show 20 more routes</button>`;
  dialog.addEventListener("input", event => { if (event.target.id === "routeTextFilter") { visible = 20; render(); } });
  dialog.addEventListener("change", event => { if (event.target.tagName === "SELECT") { visible = 20; render(); } });
  dialog.addEventListener("close", () => { sequence++; context = null; dialog.querySelector("#routeChoiceRows").replaceChildren(); });
  dialog.addEventListener("click", event => {
    const button = event.target.closest("button"); if (!button || !context) return;
    if (button.id === "routeChoicesMore") { visible += 20; render(); }
    if (button.dataset.pickRoute !== undefined) {
      const recipe = context.filtered[Number(button.dataset.pickRoute)]?.recipe, apply = context.apply;
      if (recipe) { dialog.close(); apply(recipe.id); }
    }
  });
}
export async function openRouteChoices(catalog, id, selected, apply) {
  ensure(); const good = catalog.resolve(id); if (!good) return;
  const current = ++sequence;
  context = { catalog, good, selected, apply, rows: [], filtered: [] }; visible = 20;
  dialog.querySelector("#routeChoiceGood").textContent = `${good.name} · ${good.id}`;
  dialog.querySelector("#routeChoicesStatus").textContent = "Preparing recipe comparisons…";
  dialog.querySelector("#routeChoiceRows").replaceChildren();
  for (const id of ["routeTextFilter", "routeMachineFilter", "routeMaximumVoltage"]) dialog.querySelector(`#${id}`).value = "";
  dialog.querySelector("#routeOrdering").value = "energy";
  if (!dialog.open) dialog.showModal();
  await new Promise(resolve => requestAnimationFrame(resolve));
  if (current !== sequence) return;
  context.rows = describeRouteChoices(catalog, good);
  const machines = [...new Set(context.rows.map(row => row.recipe.machine))].sort();
  dialog.querySelector("#routeMachineFilter").innerHTML = '<option value="">All machines</option>' + machines.map(machine => `<option value="${esc(machine)}">${esc(machine)}</option>`).join("");
  render();
}
