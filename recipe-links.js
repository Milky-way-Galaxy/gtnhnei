export function recipePermalink(href, { datasetId, goodId, mode = "Production", recipeId = "" }) {
  const url = new URL(href);
  // An item/recipe link must not carry an unrelated shared factory plan.
  url.search = ""; url.hash = "";
  url.searchParams.set("dataset", datasetId);
  url.searchParams.set("item", goodId);
  url.searchParams.set("view", mode === "Usage" ? "usage" : "production");
  if (recipeId) url.searchParams.set("recipe", recipeId);
  return url.href;
}
