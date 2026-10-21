import { recipeMetrics } from "./production-engine.js";
// Validate against the active catalog before changing a user's draft.
export function recipePlanState(state, catalog, goodId, recipeId) {
  const good = catalog.resolve(goodId);
  if (!good || good.id !== goodId) throw new Error("Choose an exact item or fluid in the active recipe version.");
  const recipe = catalog.recipes(good).find(row => row.id === recipeId);
  if (!recipe || !(recipeMetrics(recipe, good).output > 0)) throw new Error("This recipe has no positive net output for the selected product in this version.");
  const next = structuredClone(state), aliases = new Set([good.id, (good.name || "").toLowerCase()]);
  Object.assign(next, { target: good.id, amount: 1, unit: catalog.describe(good).unit, additionalTargets: [] });
  next.routeChoices[good.id] = recipe.id;
  next.rawOverrides = next.rawOverrides.filter(id => !aliases.has(id));
  next.ignored = next.ignored.filter(id => !aliases.has(id));
  return next;
}
