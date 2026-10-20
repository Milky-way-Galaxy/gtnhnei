// SPDX-License-Identifier: LGPL-3.0-or-later
// GT5 formulas adapted from GTNewHorizons/GT5-Unofficial, OverclockCalculator
// (000a4d9 and a3e1e11). Reference pins, scope and license: docs/machine-models.md.
export const voltageTiers = Object.freeze(["ULV", "LV", "MV", "HV", "EV", "IV", "LuV", "ZPM", "UV", "UHV", "UEV", "UIV", "UMV", "UXV", "MAX"]);
export const tierVoltages = Object.freeze(voltageTiers.map((_, i) => i === 14 ? 2147483640 : 8 * 4 ** i));
export const machineRulesets = Object.freeze({
  "gt5-5.09.51.470": "GT5 5.09.51.470 · GTNH 2.8.0",
  "gt5-5.09.54.205": "GT5 5.09.54.205 · GTNH 2.9.0 RC-2 reference"
});
export const defaultRuleset = datasetId => datasetId === "gtnh-2.9.0" ? "gt5-5.09.54.205" : "gt5-5.09.51.470";
const integer = (value, minimum, maximum, label) => {
  const result = Number(value);
  if (value === "" || value === null || typeof value === "boolean" || !Number.isInteger(result) || result < minimum || result > maximum) throw new Error(`${label} must be a whole number from ${minimum} to ${maximum}.`);
  return result;
};
export function validateMachineConfig(config = {}) {
  if (!config || typeof config !== "object" || Array.isArray(config)) throw new Error("Invalid machine profile.");
  integer(config.parallels ?? 1, 1, 4096, "Parallel lanes");
  integer(config.overclocks ?? 0, 0, 10, "Overclocks");
  if (config.overclockMode && !["normal", "perfect"].includes(config.overclockMode)) throw new Error("Unknown overclock model.");
  if (config.installedMachines !== undefined) integer(config.installedMachines, 0, 1000000, "Installed machines");
  if (!["generic", "gt5", "ebf"].includes(config.model || "generic")) throw new Error("Unknown machine model.");
  if (config.model && config.model !== "generic") integer(config.voltageTier, 0, 14, "Voltage tier");
  if (config.model === "ebf") integer(config.machineHeat, 0, 100000, "Machine heat (K)");
  if (config.ruleset !== undefined && !Object.hasOwn(machineRulesets, config.ruleset)) throw new Error("Unknown GT5 calculation reference.");
  if (config.voltageTier !== undefined) integer(config.voltageTier, 0, 14, "Voltage tier");
  if (config.machineAmperage !== undefined) integer(config.machineAmperage, 1, 4096, "Available amps");
  if (config.maxOverclocks !== undefined) integer(config.maxOverclocks, 0, 14, "Overclock limit");
  if (config.machineHeat !== undefined) integer(config.machineHeat, 0, 100000, "Machine heat (K)");
  if (config.amperageOC !== undefined && typeof config.amperageOC !== "boolean") throw new Error("Amperage overclocking must be enabled or disabled.");
  return config;
}
export function ebfRecipeHeat(recipe) {
  // Check the actual crafter ID, not a translated machine name or a special value
  // which can mean something completely different on other recipe maps.
  if (!recipe.crafters?.some(crafter => crafter.id === "i:gregtech:gt.blockmachines:1000")) return null;
  const heat = recipe.metadata?.find(entry => entry.key === "coil_heat")?.value;
  return Number.isInteger(heat) && heat >= 0 && heat === recipe.specialValue ? heat : null;
}
// Match GTUtility.powInt's evaluation order, including the final ceil of EU/t.
function power(base, exponent) {
  let result = 1;
  for (; exponent > 0; exponent = Math.floor(exponent / 2), base *= base) if (exponent % 2) result *= base;
  return result;
}
function log4(value, ceil = false) {
  let exponent = 0, threshold = 1;
  while (ceil ? threshold < value : threshold * 4 <= value) { threshold *= 4; exponent++; }
  return exponent;
}
export function machinePerformance(recipe, config = {}) {
  validateMachineConfig(config);
  if (!(recipe.durationTicks > 0) || recipe.eut === null || recipe.eut === undefined) return null;
  if (!Number.isFinite(recipe.eut) || recipe.eut < 0 || !Number.isFinite(recipe.durationTicks)) throw new Error("Invalid recipe timing/power.");
  const parallels = Number(config.parallels ?? 1);
  if (!config.model || config.model === "generic") {
    const overclocks = Number(config.overclocks ?? 0);
    const durationTicks = Math.max(1, Math.floor(recipe.durationTicks / (config.overclockMode === "perfect" ? 4 : 2) ** overclocks));
    const laneEut = recipe.eut * 4 ** overclocks;
    return { durationTicks, parallels, laneEut, eut: laneEut * parallels, batchesPerSecond: 20 * parallels / durationTicks };
  }
  const voltageTier = integer(config.voltageTier, 0, 14, "Voltage tier"), voltage = tierVoltages[voltageTier];
  const amps = Number(config.machineAmperage ?? 1), availableEut = voltage * amps;
  const ruleset = config.ruleset || defaultRuleset(recipe.datasetId);
  const isEbf = config.model === "ebf", recipeHeat = isEbf ? ebfRecipeHeat(recipe) : null;
  if (isEbf && recipeHeat === null) throw new Error("The EBF model requires a verified Electric Blast Furnace crafter and coil_heat metadata.");
  if (isEbf && parallels !== 1) throw new Error("The standard Electric Blast Furnace model supports one lane. Use a separate generic profile for other blast furnaces.");
  if (isEbf && config.overclockMode === "perfect") throw new Error("EBF perfect overclocks come from excess heat; select the normal OC model.");
  const machineHeat = isEbf ? integer(config.machineHeat, 0, 100000, "Machine heat (K)") : null;
  if (isEbf && machineHeat < recipeHeat) throw new Error(`Insufficient EBF heat: recipe needs ${recipeHeat} K; machine has ${machineHeat} K.`);
  const heatDiscounts = isEbf ? Math.floor((machineHeat - recipeHeat) / 900) : 0;
  const heatMultiplier = power(.95, heatDiscounts);
  const recipePower = recipe.eut * parallels * heatMultiplier;
  // ParallelHelper checks per-lane discounted power and its default one-tier
  // skip before executing. We require the requested lanes to fit, not silently
  // reduce parallelism and change the user's intended machine configuration.
  if (recipe.eut > voltage * 4) throw new Error("Recipe exceeds this GT5 profile's one-tier voltage-skip limit.");
  if (Math.ceil(recipe.eut * heatMultiplier) * parallels > availableEut) throw new Error("Insufficient input power for the requested parallel lanes. Increase voltage/amps or reduce lanes.");
  const machinePower = voltage * (config.amperageOC ? amps : Math.min(amps, parallels));
  const ratio = ruleset === "gt5-5.09.51.470" ? Math.floor(machinePower / Math.max(Math.floor(recipePower), 32)) :
    Math.floor(Math.round(machinePower * 100) / Math.max(Math.round(recipePower * 100), 3200));
  const powerOverclocks = log4(ratio);
  // GT5 intentionally treats ULV recipes as LV when limiting voltage OCs, and
  // uses integer division by eight before computing each tier.
  const voltageOverclocks = Math.max(1, log4(Math.floor(voltage / 8), true)) - Math.max(1, log4(Math.floor(recipe.eut / 8), true));
  const overclocks = Math.max(0, Math.min(Number(config.maxOverclocks ?? 14), powerOverclocks, config.amperageOC ? Infinity : voltageOverclocks));
  const heatOverclocks = Math.min(isEbf ? Math.floor((machineHeat - recipeHeat) / 1800) : 0, overclocks);
  const durationBeforeFloor = recipe.durationTicks / 4 ** heatOverclocks / (config.overclockMode === "perfect" ? 4 : 2) ** (overclocks - heatOverclocks);
  const durationTicks = Math.max(1, Math.floor(durationBeforeFloor));
  const eut = Math.ceil(recipePower * 4 ** overclocks);
  if (eut > availableEut) throw new Error("Calculated consumption exceeds available power. Reduce the overclock limit or increase the input supply.");
  return { durationTicks, parallels, laneEut: eut / parallels, eut, batchesPerSecond: 20 * parallels / durationTicks,
    model: config.model, ruleset, voltage, availableEut, overclocks, heatOverclocks, heatDiscounts, heatMultiplier, recipeHeat, machineHeat,
    tickLimited: durationBeforeFloor < 1 };
}
