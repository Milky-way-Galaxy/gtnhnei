import { recipeBalance } from "./production-engine.js";
const scalar = value => JSON.stringify(value);
const mapYaml = (key, entries) => {
  const grouped = new Map();
  for (const entry of entries) grouped.set(entry.name, (grouped.get(entry.name) || 0) + entry.amount);
  return grouped.size ? `  ${key}:\n` + [...grouped].map(([name, amount]) => `    ${scalar(name.toLowerCase())}: ${amount}`).join("\n") : `  ${key}: {}`;
};
export function exportRecipeYaml(catalog, query, index = 0) {
  const object = catalog.resolve(query) || catalog.findCompatible(query);
  if (!object) return { ok: false, error: "Target not found", yaml: "# Target not found.\n" };
  const recipes = catalog.recipes(object);
  const recipe = recipes[Number(index)];
  if (!recipe) return { ok: false, error: "Production route not found", yaml: "# No such production route.\n", input: {}, output: {} };
  const balance = recipeBalance(recipe);
  const toMap = entries => Object.fromEntries([...new Set(entries.map(io => io.name))].map(name => [name, entries.filter(io => io.name === name).reduce((n, io) => n + io.amount, 0)]));
  const yaml = [`# GTNH Atlas recipe: ${recipe.id}`, `# Dataset: ${catalog.dataset.id}`, "# Base recipe values; chance outputs are expected values.",
    ...balance.reusable.map(io => `# Reusable startup stock: ${io.amount} ${io.name}`),
    `- m: ${scalar(recipe.machine.toLowerCase())}`, `  tier: ${scalar(recipe.tier || "LV")}`,
    mapYaml("I", balance.inputs), mapYaml("O", balance.outputs), `  eut: ${recipe.eut ?? 0}`, `  dur: ${recipe.durationTicks === null ? 1 : recipe.durationTicks / 20}`, "  number: 1",
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
  const lines = [`# Dataset: ${plan.dataset.id}`, "# Quantities are base recipes; chance outputs use expected values.", "# Review machine-specific modifiers and byproduct/recycling links before solving."];
  for (const step of plan.steps) {
    const recipe = step.recipe, balance = recipeBalance(recipe);
    if (recipe.durationTicks === null) { lines.push(`# OMITTED ${recipe.id}: timing unknown (${recipe.machine})`); continue; }
    lines.push(`# Recipe ${recipe.id}`, `- m: ${scalar(recipe.machine.toLowerCase())}`, `  tier: ${scalar(recipe.tier)}`,
      mapYaml("I", balance.inputs), mapYaml("O", balance.outputs), `  eut: ${recipe.eut}`, `  dur: ${recipe.durationTicks / 20}`,
      `  number: ${plan.isRate ? step.batches * recipe.durationTicks / 20 : 1}`);
  }
  if (plan.unresolved.length) lines.push("# WARNING: some dependencies remain unresolved; see the plan's material summary.");
  return lines.join("\n") + "\n";
}
