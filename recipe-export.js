import { recipeBalance } from "./production-engine.js";
const scalar = value => JSON.stringify(value);
const mapYaml = (key, entries, label = io => io.name) => {
  const grouped = new Map();
  for (const entry of entries) {
    const name = label(entry).toLowerCase();
    grouped.set(name, (grouped.get(name) || 0) + entry.amount);
  }
  return grouped.size ? `  ${key}:\n` + [...grouped].map(([name, amount]) => `    ${scalar(name)}: ${amount}`).join("\n") : `  ${key}: {}`;
};
export function exportRecipeYaml(catalog, query, index = 0) {
  const object = catalog.resolve(query);
  if (!object) {
    const error = catalog.matches(query).length > 1 ? "Several goods have this name. Select an exact item/fluid ID." : "Target not found. Select an exact name or item/fluid ID.";
    return { ok: false, error, yaml: `# ${error}\n`, input: {}, output: {} };
  }
  const recipes = catalog.recipes(object);
  const recipe = recipes[Number(index)];
  if (!recipe) return { ok: false, error: "Production route not found", yaml: "# No such production route.\n", input: {}, output: {} };
  const balance = recipeBalance(recipe);
  const label = io => catalog.matches(io.name).length > 1 ? `${io.name} [${io.id}]` : io.name;
  const toMap = entries => Object.fromEntries([...new Set(entries.map(label))].map(name => [name, entries.filter(io => label(io) === name).reduce((n, io) => n + io.amount, 0)]));
  if (recipe.durationTicks === null || recipe.eut === null) return { ok: false, error: "Timing/power is not available for this recipe.",
    machine: recipe.machine, tier: "", eut: "", dur: "", input: toMap(balance.inputs), output: toMap(balance.outputs),
    yaml: `# Recipe ${recipe.id}: timing/power unknown. No executable solver entry was invented.\n` };
  const yaml = [`# GTNH Atlas recipe: ${recipe.id}`, `# Dataset: ${catalog.dataset.id}`, "# Base recipe values; chance outputs are expected values.",
    ...balance.reusable.map(io => `# Reusable startup stock: ${io.amount} ${io.name}`),
    `- m: ${scalar(recipe.machine.toLowerCase())}`, `  tier: ${scalar(recipe.tier || "LV")}`,
    mapYaml("I", balance.inputs, label), mapYaml("O", balance.outputs, label), `  eut: ${recipe.eut ?? 0}`, `  dur: ${recipe.durationTicks === null ? 1 : recipe.durationTicks / 20}`, "  number: 1",
    ...(recipe.durationTicks === null ? ["# WARNING: duration/EU unavailable. Timing above is a solver placeholder, not measured game data."] : [])].join("\n") + "\n";
  return { ok: true, target: object.name || object.id, routeIndex: Number(index), recipeId: recipe.id, machine: recipe.machine,
    tier: recipe.tier || "", eut: recipe.eut ?? "", dur: recipe.durationTicks === null ? "" : recipe.durationTicks / 20,
    input: toMap(balance.inputs), output: toMap(balance.outputs), inputs: recipe.inputs, outputs: recipe.outputs, yaml };
}

function csv(rows) {
  const quote = value => `"${String(value ?? "").replaceAll('"', '""')}"`;
  return rows.map(row => row.map(quote).join(",")).join("\r\n");
}
export function planCsv(plan) {
  return csv([["Dataset", "ID", "Material", "Amount", "Unit", "Reason"], ...plan.materials.map(row =>
    [plan.dataset.id, row.id, row.name, row.amount, row.unit + (plan.isRate ? "/s" : ""), row.reason])]
  );
}
export function machinesCsv(plan) {
  const capacity = new Map(plan.capacityAnalysis?.rows.map(row => [row.recipeId, row]) || []);
  return csv([["Dataset", "Recipe ID", "Machine", "Model", "Calculation reference", "Executions" + (plan.isRate ? "/s" : ""), "Ticks/batch", "Parallel lanes", "EU/t at full load", "Required machines", "Installed machines", "Count source", "Utilization", "Limiting stage", "Installed EU/t", "Total job EU"],
    ...plan.steps.map(step => [plan.dataset.id, step.recipeId, step.machine, step.performance?.model || "generic", step.performance?.ruleset,
      step.batches, step.performance?.durationTicks, step.performance?.parallels, step.performance?.eut, step.count, step.installedCount,
      plan.isRate ? step.installedSource : "", capacity.get(step.recipeId)?.utilization,
      plan.isRate ? plan.capacityAnalysis.limitingRecipeIds.includes(step.recipeId) : "", step.installedEut, plan.isRate ? "" : step.energy])]);
}
export function exportPlanYaml(plan) {
  if (!plan.steps.length) return "# Build a resolved production plan first.\n";
  const idsByName = new Map();
  for (const step of plan.steps) for (const io of [...step.recipe.inputs,...step.recipe.outputs]) {
    const name = io.name.toLowerCase(), ids = idsByName.get(name) || new Set(); ids.add(io.id); idsByName.set(name,ids);
  }
  const label = io => idsByName.get(io.name.toLowerCase())?.size > 1 ? `${io.name} [${io.id}]` : io.name;
  const lines = [`# Dataset: ${plan.dataset.id}`, "# Quantities are base recipes; chance outputs use expected values.", "# Planner installed counts and custom machine profiles are not applied to this base-recipe export.", "# Review machine-specific modifiers and byproduct/recycling links before solving."];
  for (const step of plan.steps) {
    const recipe = step.recipe, balance = recipeBalance(recipe);
    if (recipe.durationTicks === null || recipe.eut === null) { lines.push(`# OMITTED ${recipe.id}: timing unknown (${recipe.machine})`); continue; }
    lines.push(`# Recipe ${recipe.id}`, `- m: ${scalar(recipe.machine.toLowerCase())}`, `  tier: ${scalar(recipe.tier)}`,
      mapYaml("I", balance.inputs, label), mapYaml("O", balance.outputs, label), `  eut: ${recipe.eut}`, `  dur: ${recipe.durationTicks / 20}`,
      `  number: ${plan.isRate ? step.batches * recipe.durationTicks / 20 : 1}`);
  }
  if (plan.unresolved.length) lines.push("# WARNING: some dependencies remain unresolved; see the plan's material summary.");
  return lines.join("\n") + "\n";
}
