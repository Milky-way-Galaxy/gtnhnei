import { recipeMetrics, recipeBalance } from "./production-engine.js";
export function describeRouteChoices(catalog, good) {
  return catalog.recipes(good).map(recipe => {
    const metrics = recipeMetrics(recipe, good), balance = recipeBalance(recipe);
    return { recipe, metrics, balance, valid: metrics.output > 0,
      search: [recipe.machine, recipe.id, ...recipe.inputs.map(io => io.name), ...recipe.outputs.map(io => io.name)].join(" ").toLowerCase() };
  });
}
export function filterRouteChoices(entries, { machine = "", maxVoltage = null, query = "", sort = "energy" } = {}) {
  if (!["energy", "speed", "voltage", "yield", "machine"].includes(sort)) throw new Error("Unknown route ordering.");
  const q = query.trim().toLowerCase();
  const rows = entries.filter(row => (!machine || row.recipe.machine === machine) && (!q || row.search.includes(q)) &&
    (maxVoltage === null || row.recipe.voltage !== null && row.recipe.voltage !== undefined && row.recipe.voltage <= maxVoltage));
  const known = value => Number.isFinite(value) ? value : Infinity;
  const score = row => sort === "speed" ? row.metrics.outputPerSecond > 0 ? 1 / row.metrics.outputPerSecond : Infinity :
    sort === "voltage" ? known(row.recipe.voltage) : sort === "yield" ? -row.metrics.output : known(row.metrics.energyPerOutput);
  return rows.sort((a, b) => Number(b.valid) - Number(a.valid) ||
    (sort === "machine" ? a.recipe.machine.localeCompare(b.recipe.machine) : score(a) - score(b)) || a.recipe.id.localeCompare(b.recipe.id));
}
