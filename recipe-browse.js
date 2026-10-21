// Browsing compares exported base recipe batches, never upstream production costs.
export const defaultRecipeFilters = { query: "", maxVoltage: null, noChance: false, sort: "default" };
export function filterRecipeEntries(entries, filters = {}) {
  const { query, maxVoltage, noChance, sort } = { ...defaultRecipeFilters, ...filters };
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const rows = entries.filter(({ recipe, search }) => words.every(word => search.includes(word)) &&
    (maxVoltage === null || Number.isFinite(recipe.voltage) && recipe.voltage >= 0 && recipe.voltage <= maxVoltage) &&
    (!noChance || recipe.outputs.every(io => io.probability === 1)));
  const known = value => Number.isFinite(value) && value >= 0 ? value : Infinity;
  const score = ({ recipe }) => sort === "duration" ? recipe.durationTicks > 0 ? recipe.durationTicks : Infinity :
    sort === "energy" ? recipe.durationTicks > 0 && Number.isFinite(recipe.eut) && recipe.eut >= 0 ? recipe.durationTicks * recipe.eut : Infinity :
    known(sort === "voltage" ? recipe.voltage : recipe.eut);
  if (sort !== "default") rows.sort((a, b) => (sort === "machine" ? a.recipe.machine.localeCompare(b.recipe.machine) : score(a) - score(b)) || a.index - b.index);
  return rows;
}
export function recipeBrowseEntry(recipe, index) {
  return { recipe, index, search: [recipe.id, recipe.machine, ...recipe.inputs.flatMap(io => [io.name, io.id]),
    ...recipe.outputs.flatMap(io => [io.name, io.id])].join(" ").toLowerCase() };
}
