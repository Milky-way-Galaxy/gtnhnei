import { defaultPlannerState, normalizePlannerState } from "./planner-state.js";

// Reading a legacy draft never writes to or removes its original storage keys.
export function readMaterialDraft(catalog, storage) {
  const suffix = catalog.dataset.id === "gtnh-2.8.0" ? "" : `_${catalog.dataset.id}`;
  const keys = suffix ? [`gtnh_material_calc_state_v4${suffix}`] : [1, 2, 3, 4].map(version => `gtnh_material_calc_state_v${version}`);
  const originals = {}, issues = [];
  let raw = {};
  for (const key of keys) {
    let text;
    try { text = storage?.getItem(key); }
    catch { return { originals, issues: ["Legacy calculator storage is unavailable."], state: null }; }
    if (!text) continue;
    originals[key] = text;
    try {
      const value = JSON.parse(text);
      if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
      raw = { ...raw, ...value };
    } catch { issues.push(`${key} could not be read; its original text is retained for backup.`); }
  }
  if (!raw.target) return { originals, issues, state: null };
  try {
    const migrated = materialDraftToPlan(raw, catalog);
    return { originals, raw, issues: [...issues, ...migrated.issues], state: migrated.state };
  } catch (error) { return { originals, raw, issues: [...issues, error.message], state: null }; }
}

export function materialDraftToPlan(raw, catalog) {
  const target = catalog.resolve(String(raw.target || ""));
  if (!target) throw new Error("The legacy target is missing or ambiguous in this version. The original draft is available for backup.");
  const issues = [], routes = catalog.recipes(target);
  const index = Number(raw.routeIndex ?? 0), route = Number.isInteger(index) && index >= 0 ? routes[index] : null;
  if (!route) issues.push("The legacy production route is unavailable. Choose a route before calculating.");
  const ignored = [];
  for (const name of Array.isArray(raw.manualIgnored) ? raw.manualIgnored : []) {
    const good = catalog.resolve(name);
    if (good) ignored.push(good.id);
    else issues.push(`Ignored material “${name}” needs review; no replacement was guessed.`);
  }
  const amount = Number(raw.amount ?? 1);
  if (!(amount > 0) || !Number.isFinite(amount)) issues.push("The unfinished legacy quantity was reset to 1; route and supply settings were retained.");
  const state = normalizePlannerState({
    ...structuredClone(defaultPlannerState), uiMode: "basic", target: target.id,
    amount: amount > 0 && Number.isFinite(amount) ? amount : 1,
    unit: raw.amountMode === "target" ? catalog.describe(target).unit : raw.amountMode === "stacks" ? "stacks" : "batches",
    rounding: "fractional", depth: String(Math.max(1, Math.min(50, Number(raw.depth) || 1))),
    nodeLimit: Math.max(100, Math.min(20000, Number(raw.nodeLimit) || 2500)),
    routeMode: route ? "ask" : "manual", routeChoices: route ? { [target.id]: route.id } : {}, ignored,
    settings: { ...defaultPlannerState.settings, waterFree: raw.waterFree ?? false, steamFree: raw.steamFree ?? false,
      cellsReusable: raw.cellsReusable ?? true, expandCircuits: !(raw.ignoreCircuits ?? true), expandMachines: true, expandPlatesWires: true },
  });
  return { state, issues };
}

export function factorySettingsSummary(state) {
  const parts = [];
  if (state.additionalTargets.length) parts.push(`${state.additionalTargets.length} additional output(s)`);
  if (Object.keys(state.inventory).length) parts.push(`${Object.keys(state.inventory).length} inventory entry/entries`);
  if (Object.keys(state.machineConfigs).length) parts.push(`${Object.keys(state.machineConfigs).length} machine profile(s)`);
  if (state.machineMode === "fixed" || state.machineCount !== 1) parts.push(`${state.machineCount} root machines`);
  if (state.rawOverrides.length) parts.push(`${state.rawOverrides.length} external supply override(s)`);
  if (state.ignored.length) parts.push(`${state.ignored.length} freely supplied material(s)`);
  if (state.balanceMode === "steady_state") parts.push("steady-state balancing");
  return parts;
}
