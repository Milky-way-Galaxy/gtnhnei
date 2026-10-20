import { voltageTiers, tierVoltages, machineRulesets, defaultRuleset, ebfRecipeHeat, heatingCoilsForRuleset, ebfMachineHeat } from "./machine-model.js";
const esc = value => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
export function initialMachineConfig(recipe, previous, model, datasetId) {
  const next = { ...previous, model };
  if (model === "generic") return next;
  if (model === "ebf") { next.parallels = 1; next.overclockMode = "normal"; next.machineHeat ??= ebfRecipeHeat(recipe); }
  next.ruleset ??= defaultRuleset(datasetId);
  const tier = tierVoltages.findIndex(voltage => voltage >= recipe.eut * (next.parallels || 1));
  next.voltageTier ??= tier < 0 ? 14 : tier;
  next.machineAmperage ??= 1; next.maxOverclocks ??= 14;
  return next;
}
export function machineProfileHtml(step, config, datasetId) {
  const checked = config.model && config.model !== "generic", isEbf = config.model === "ebf";
  const numeric = (field, label, value, min, max, readOnly = false) => `<label>${label}<input type="number" min="${min}" max="${max}" step="1" data-profile-field="${field}" value="${value}" ${readOnly ? "readonly" : ""}></label>`;
  const select = (field, label, values, value) => `<label>${label}<select data-profile-field="${field}">${values.map(([id, name]) => `<option value="${id}" ${id === value ? "selected" : ""}>${esc(name)}</option>`).join("")}</select></label>`;
  const modes = [["generic", "Generic · manual overclocks"], ["gt5", "GT5 · voltage and power checked"]];
  if (ebfRecipeHeat(step.recipe) !== null) modes.push(["ebf", "Electric Blast Furnace · heat and power checked"]);
  return `<div class="plannerProfile" data-profile="${esc(step.recipeId)}">
    ${select("model", "Machine calculation", modes, config.model || "generic")}
    ${numeric("parallels", "Parallel lanes", config.parallels || 1, 1, isEbf ? 1 : 4096)}
    ${checked ? select("ruleset", "Calculation reference", Object.entries(machineRulesets), config.ruleset || defaultRuleset(datasetId)) +
      select("voltageTier", "Available voltage tier", voltageTiers.map((name, index) => [String(index), `${name} · ${tierVoltages[index].toLocaleString("en")} V`]), String(config.voltageTier)) +
      numeric("machineAmperage", "Available amps", config.machineAmperage ?? 1, 1, 4096) + numeric("maxOverclocks", "Overclock limit", config.maxOverclocks ?? 14, 0, 14) +
      (isEbf ? select("coilLevel", "Heating coils", [["", "Use measured machine heat"], ...heatingCoilsForRuleset(config.ruleset || defaultRuleset(datasetId)).map(coil => [String(coil.level), `${coil.name} · ${coil.heat.toLocaleString("en")} K base`])], config.coilLevel === undefined ? "" : String(config.coilLevel)) +
        numeric("machineHeat", config.coilLevel === undefined ? "Machine heat from info screen (K)" : "Effective heat including voltage bonus (K)", ebfMachineHeat(config), 0, 100000, config.coilLevel !== undefined) : "") +
      `<label class="plannerProfileCheck"><input type="checkbox" data-profile-field="amperageOC" ${config.amperageOC ? "checked" : ""}> Use amps for overclocks (if supported)</label>` :
      numeric("overclocks", "Overclocks", config.overclocks || 0, 0, 10)}
    ${isEbf ? "" : select("overclockMode", "OC model", [["normal", "Normal (4×EU / 2×speed)"], ["perfect", "Perfect (4×EU / 4×speed)"]], config.overclockMode || "normal")}
  </div>${checked ? `<p class="plannerHint">Configured supply at the machine, before cable losses. This uses the named GT5 reference; the 2.9 RC-2 reference is not an assertion of the recipe export's exact GT5 build. Parallel and perfect-OC support must be checked for your machine.${isEbf ? " Enter the machine's displayed heat, including its voltage bonus. Other blast furnace variants need their own models." : ""}</p>` : ""}`;
}
