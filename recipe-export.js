import { recipeBalance } from "./production-engine.js";
const scalar = value => JSON.stringify(value);
const mapYaml = (key, entries, label = io => io.name) => {
  const grouped = new Map();
  for (const entry of entries) grouped.set(label(entry), (grouped.get(label(entry)) || 0) + entry.amount);
  return grouped.size ? `  ${key}:\n` + [...grouped].map(([name, amount]) => `    ${scalar(name.toLowerCase())}: ${amount}`).join("\n") : `  ${key}: {}`;
};
export function exportRecipeYaml(catalog, query, index = 0) {
  const object = catalog.resolve(query) || catalog.findCompatible(query);
  if (!object) return { ok: false, error: "Target not found", yaml: "# Target not found.\n" };
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

export function planCsv(plan) {
  const quote = value => `"${String(value ?? "").replaceAll('"', '""')}"`;
  return [["Dataset", "ID", "Material", "Amount", "Unit", "Reason"], ...plan.materials.map(row =>
    [plan.dataset.id, row.id, row.name, row.amount, row.unit + (plan.isRate ? "/s" : ""), row.reason])]
    .map(row => row.map(quote).join(",")).join("\r\n");
}
export function exportPlanYaml(plan) {
  if (!plan.steps.length) return "# Build a resolved production plan first.\n";
  const idsByName = new Map();
  for (const step of plan.steps) for (const io of [...step.recipe.inputs,...step.recipe.outputs]) {
    const ids = idsByName.get(io.name) || new Set(); ids.add(io.id); idsByName.set(io.name,ids);
  }
  const label = io => idsByName.get(io.name)?.size > 1 ? `${io.name} [${io.id}]` : io.name;
  const lines = [`# Dataset: ${plan.dataset.id}`, "# Quantities are base recipes; chance outputs use expected values.", "# Review machine-specific modifiers and byproduct/recycling links before solving."];
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
