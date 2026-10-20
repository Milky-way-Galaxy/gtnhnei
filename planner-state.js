import { validateMachineConfig, defaultRuleset } from "./machine-model.js";
export const defaultPlannerState = {
  target: "", amount: 1, unit: "items", rateMode: "total", depth: "1", routeMode: "ask", machineMode: "auto", machineCount: 1,
  rounding: "whole", routeChoices: {}, oreChoices: {}, machineConfigs: {}, lockedRoutes: {}, rawOverrides: [], ignored: [], inventory: {}, additionalTargets: [],
  settings: { waterFree: true, steamFree: true, cellsReusable: true, expandCircuits: false, expandMachines: false, expandPlatesWires: false, reuseByproducts: false }
};
export function normalizePlannerState(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Invalid plan settings.");
  const state = { ...structuredClone(defaultPlannerState), ...raw, settings: { ...defaultPlannerState.settings, ...raw.settings } };
  if (!Number.isFinite(Number(state.amount)) || Number(state.amount) <= 0) throw new Error("Amount must be finite and greater than zero.");
  for (const [key, values] of Object.entries({ rateMode: ["total", "per_second", "per_minute", "per_hour"], unit: ["items", "L", "buckets", "batches", "stacks"],
    routeMode: ["ask", "manual", "lowest_tier", "lowest_eut", "lowest_energy", "fastest", "fewest_inputs"], rounding: ["whole", "fractional"], machineMode: ["auto", "fixed"] })) {
    if (!values.includes(state[key])) throw new Error(`Invalid ${key}.`);
  }
  if (typeof state.target !== "string" || state.target.length > 512) throw new Error("Invalid target.");
  for (const key of ["routeChoices", "oreChoices", "machineConfigs", "lockedRoutes"]) {
    if (!state[key] || typeof state[key] !== "object" || Array.isArray(state[key])) throw new Error(`Invalid ${key}.`);
    if (Object.keys(state[key]).length > 10000 || Object.hasOwn(state[key], "__proto__")) throw new Error(`Invalid ${key}.`);
  }
  for (const key of ["rawOverrides", "ignored"]) if (!Array.isArray(state[key]) || state[key].some(value => typeof value !== "string")) throw new Error(`Invalid ${key}.`);
  for (const config of Object.values(state.machineConfigs)) {
    if (!config || typeof config !== "object" || Array.isArray(config)) throw new Error("Invalid machine profile.");
    // Earlier drafts/imports accepted arbitrary generic profile values. An
    // unused stale profile must not discard unrelated routes/preferences on
    // restore. The engine validates every profile it actually uses. New profile
    // fields, introduced with checked models/count overrides, validate eagerly.
    if (["model", "ruleset", "installedMachines", "voltageTier", "machineAmperage", "maxOverclocks", "machineHeat", "amperageOC", "coilLevel"].some(field => Object.hasOwn(config, field))) validateMachineConfig(config);
  }
  if (!state.inventory || typeof state.inventory !== "object" || Array.isArray(state.inventory) || Object.keys(state.inventory).length > 1000 || Object.hasOwn(state.inventory, "__proto__")) throw new Error("Invalid inventory.");
  state.inventory = { ...state.inventory };
  for (const [id, quantity] of Object.entries(state.inventory)) {
    if (!/^[if]:/.test(id) || !Number.isFinite(Number(quantity)) || Number(quantity) < 0) throw new Error("Inventory requires exact item/fluid IDs and finite non-negative quantities.");
    state.inventory[id] = Number(quantity);
  }
  if (!Array.isArray(state.additionalTargets) || state.additionalTargets.length > 19) throw new Error("A factory supports up to 20 output targets.");
  state.additionalTargets = state.additionalTargets.map(entry => {
    if (!entry || typeof entry !== "object" || typeof entry.target !== "string" || entry.target.length > 512 || !Number.isFinite(Number(entry.amount)) || Number(entry.amount) <= 0 ||
      !["items", "L", "buckets", "batches", "stacks"].includes(entry.unit) || entry.machineCount !== undefined && (!Number.isInteger(Number(entry.machineCount)) || Number(entry.machineCount) < 1 || Number(entry.machineCount) > 1000000)) throw new Error("Invalid factory output target.");
    return { target: entry.target, amount: Number(entry.amount), unit: entry.unit, machineCount: Number(entry.machineCount ?? 1) };
  });
  state.machineCount = Math.max(1, Math.min(1000000, Math.floor(Number(state.machineCount) || 1)));
  state.depth = state.depth === "full" ? "full" : String(Math.max(1, Math.min(64, Math.floor(Number(state.depth) || 1))));
  return state;
}
export function serializePlan(state, dataset) {
  const settings = normalizePlannerState(state);
  const checked = config => ["gt5", "ebf"].includes(config.model);
  // Stamp a reference even for callers which used the API's default. Future
  // default changes must not change the meaning of an exported machine plan.
  settings.machineConfigs = Object.fromEntries(Object.entries(settings.machineConfigs).map(([id, config]) =>
    [id, checked(config) ? { ...config, ruleset: config.ruleset ?? defaultRuleset(dataset.id) } : config]));
  const requiresMachineModels = Object.values(settings.machineConfigs).some(config => checked(config) || config.installedMachines !== undefined);
  // Old clients must reject, rather than silently ignore, numeric semantics
  // which they cannot evaluate. Existing single/factory plans keep v1/v2.
  const schemaVersion = requiresMachineModels ? 3 : settings.additionalTargets.length ? 2 : 1;
  return JSON.stringify({ format: "gtnh-atlas-plan", schemaVersion, dataset: { id: dataset.id, sha256: dataset.sha256 || null }, settings }, null, 2);
}
export function importPlan(text, dataset) {
  if (text.length > 2000000) throw new Error("Plan exceeds the 2 MB import limit.");
  const data = JSON.parse(text);
  if (data.format) {
    if (data.format !== "gtnh-atlas-plan" || ![1, 2, 3].includes(data.schemaVersion) || data.schemaVersion === 1 && data.settings?.additionalTargets?.length) throw new Error("Unsupported plan format/version.");
    if (data.dataset?.id !== dataset.id || (data.dataset.sha256 && data.dataset.sha256 !== dataset.sha256)) throw new Error("This plan belongs to a different recipe dataset. Switch to that dataset before importing.");
    return normalizePlannerState(data.settings);
  }
  // Older Atlas exports contained settings only. Preserve them as legacy imports;
  // their route indexes should be reviewed against the active database.
  if (dataset.id !== "gtnh-2.8.0") throw new Error("Legacy plans have no dataset identity and can only be imported into the original bundled 2.8.0 dataset.");
  return normalizePlannerState(data);
}
