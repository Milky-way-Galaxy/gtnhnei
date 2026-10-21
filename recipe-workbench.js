import { defaultRecipeFilters } from "./recipe-browse.js";
import { voltageTiers, tierVoltages } from "./machine-model.js";
export function mountRecipeWorkbench(before, onChange) {
  const panel = document.createElement("details"); panel.id = "recipeWorkbench";
  panel.innerHTML = `<summary>Filter & sort recipes <span id="recipeFilterBadge"></span></summary><div class="recipeFilterFields"><label>Find machine, ingredient or ID<input id="recipeFind" type="search" placeholder="e.g. chlorine or circuit"></label><label>Maximum recipe voltage<select id="recipeMaxVoltage"><option value="">Any / unknown</option>${voltageTiers.map((tier, index) => `<option value="${tierVoltages[index]}">${tier} · ${tierVoltages[index].toLocaleString("en")} V</option>`).join("")}</select></label><label>Order recipes<select id="recipeOrdering"><option value="default">Dataset order</option><option value="voltage">Lowest recipe voltage</option><option value="eut">Lowest base EU/t</option><option value="energy">Lowest base EU per batch</option><option value="duration">Shortest base batch time</option><option value="machine">Machine name</option></select></label><label class="recipeFilterCheck"><input id="recipeNoChance" type="checkbox"> No chance outputs</label><button id="recipeFilterReset" type="button">Reset recipe filters</button></div><p>Base batch values only; output quantities vary. Voltage filtering excludes unknown power and does not check machine availability or recipe conditions.</p>`;
  before.before(panel);
  const field = id => panel.querySelector(`#${id}`);
  function values() { return { query: field("recipeFind").value, maxVoltage: field("recipeMaxVoltage").value === "" ? null : Number(field("recipeMaxVoltage").value),
    noChance: field("recipeNoChance").checked, sort: field("recipeOrdering").value }; }
  function changed() {
    const filters = values(), count = Number(!!filters.query.trim()) + Number(filters.maxVoltage !== null) + Number(filters.noChance) + Number(filters.sort !== "default");
    field("recipeFilterBadge").textContent = count ? `${count} active` : ""; onChange(filters);
  }
  panel.addEventListener("input", event => { if (event.target.id === "recipeFind") changed(); });
  panel.addEventListener("change", event => { if (event.target.id !== "recipeFind") changed(); });
  function reset(notify = true) {
    field("recipeFind").value = ""; field("recipeMaxVoltage").value = ""; field("recipeOrdering").value = "default";
    field("recipeNoChance").checked = false; field("recipeFilterBadge").textContent = "";
    if (notify) onChange({ ...defaultRecipeFilters });
  }
  field("recipeFilterReset").addEventListener("click", () => reset());
  return { reset };
}
