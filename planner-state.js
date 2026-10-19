export const defaultPlannerState = {
  target: "", amount: 1, unit: "items", rateMode: "total", depth: "1", routeMode: "ask", machineMode: "auto", machineCount: 1,
  rounding: "whole", routeChoices: {}, oreChoices: {}, machineConfigs: {}, lockedRoutes: {}, rawOverrides: [], ignored: [],
  settings: { waterFree: true, steamFree: true, cellsReusable: true, expandCircuits: false, expandMachines: false, expandPlatesWires: false }
};
export function normalizePlannerState(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Invalid plan settings.");
  const state = { ...structuredClone(defaultPlannerState), ...raw, settings: { ...defaultPlannerState.settings, ...raw.settings } };
  if (!Number.isFinite(Number(state.amount)) || Number(state.amount) <= 0) throw new Error("Amount must be finite and greater than zero.");
  for (const [key, values] of Object.entries({ rateMode: ["total", "per_second", "per_minute", "per_hour"], unit: ["items", "L", "buckets", "batches"],
    routeMode: ["ask", "manual", "lowest_tier", "lowest_eut", "fastest", "fewest_inputs"], rounding: ["whole", "fractional"], machineMode: ["auto", "fixed"] })) {
    if (!values.includes(state[key])) throw new Error(`Invalid ${key}.`);
  }
  if (typeof state.target !== "string" || state.target.length > 512) throw new Error("Invalid target.");
  for (const key of ["routeChoices", "oreChoices", "machineConfigs", "lockedRoutes"]) {
    if (!state[key] || typeof state[key] !== "object" || Array.isArray(state[key])) throw new Error(`Invalid ${key}.`);
    if (Object.keys(state[key]).length > 10000 || Object.hasOwn(state[key], "__proto__")) throw new Error(`Invalid ${key}.`);
  }
  for (const key of ["rawOverrides", "ignored"]) if (!Array.isArray(state[key]) || state[key].some(value => typeof value !== "string")) throw new Error(`Invalid ${key}.`);
  state.machineCount = Math.max(1, Math.min(1000000, Math.floor(Number(state.machineCount) || 1)));
  state.depth = state.depth === "full" ? "full" : String(Math.max(1, Math.min(64, Math.floor(Number(state.depth) || 1))));
  return state;
}
export function serializePlan(state, dataset) {
  return JSON.stringify({ format: "gtnh-atlas-plan", schemaVersion: 1, dataset: { id: dataset.id, sha256: dataset.sha256 || null }, settings: normalizePlannerState(state) }, null, 2);
}
export function importPlan(text, dataset) {
  if (text.length > 2000000) throw new Error("Plan exceeds the 2 MB import limit.");
  const data = JSON.parse(text);
  if (data.format) {
    if (data.format !== "gtnh-atlas-plan" || data.schemaVersion !== 1) throw new Error("Unsupported plan format/version.");
    if (data.dataset?.id !== dataset.id || (data.dataset.sha256 && data.dataset.sha256 !== dataset.sha256)) throw new Error("This plan belongs to a different recipe dataset. Switch to that dataset before importing.");
    return normalizePlannerState(data.settings);
  }
  // Older Atlas exports contained settings only. Preserve them as legacy imports;
  // their route indexes should be reviewed against the active database.
  return normalizePlannerState(data);
}
