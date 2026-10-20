import { compactName } from "./recipe-data.js";

// New choices use exact good IDs. A legacy name/index choice is safe only for a
// unique name; a saved recipe ID can also identify its exact output unambiguously.
export function makerChoiceFor(state, catalog, good, section = "makers") {
  const choices = state[section] || {};
  if (Object.hasOwn(choices, good.id)) return choices[good.id] && typeof choices[good.id] === "object" ? choices[good.id] : null;
  const legacyKey = compactName(good.name);
  const legacy = Object.hasOwn(choices, legacyKey) ? choices[legacyKey] : null;
  if (!legacy || typeof legacy !== "object") return null;
  if (legacy.goodId) return legacy.goodId === good.id ? legacy : null;
  if (catalog.matches(good.name).length === 1) return legacy;
  return section === "makers" && legacy.recipeId && catalog.recipes(good).some(recipe => recipe.id === legacy.recipeId) ? legacy : null;
}

export function makerRouteIndex(catalog, good, choice, fallback = 0) {
  if (!choice) return fallback;
  if (choice.recipeId) return catalog.recipes(good).findIndex(recipe => recipe.id === choice.recipeId);
  const index = Number(choice.routeIndex);
  return Number.isInteger(index) && index >= 0 ? index : fallback;
}
