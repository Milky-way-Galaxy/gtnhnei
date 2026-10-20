import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { Repository, Recipe } from "../dist/repository.js";
import { RecipeCatalog } from "../recipe-data.js";
import { validateManifest } from "../datasets.js";
const manifest = validateManifest(JSON.parse(readFileSync(new URL("../data/manifest.json", import.meta.url))));
for (const dataset of manifest.datasets.filter(value => value.available)) {
  const compressed = readFileSync(new URL("../" + dataset.dataUrl, import.meta.url));
  assert.equal(createHash("sha256").update(compressed).digest("hex"), dataset.sha256);
  const bytes = gunzipSync(compressed);
  const repo = Repository.load(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length));
  assert.equal(repo.items.length, dataset.items); assert.equal(repo.fluids.length, dataset.fluids); assert.equal(repo.recipes.length, dataset.recipes);
  const catalog = new RecipeCatalog(repo, dataset);
  for (const pointer of repo.recipes) {
    const raw = repo.GetObject(pointer, Recipe), recipe = catalog.recipe(raw);
    assert.equal(recipe.id, raw.id);
    for (const io of [...recipe.inputs, ...recipe.outputs]) {
      assert.ok(io.id && Number.isFinite(io.amount) && io.amount >= 0 && Number.isFinite(io.probability) && io.probability >= 0, `Invalid IO: ${recipe.id}`);
    }
    if (catalog.recipeCache.size > 2000) catalog.recipeCache.clear();
    delete raw.computedIo;
  }
  console.log(`${dataset.label}: verified ${dataset.recipes.toLocaleString()} recipes and original quantities/probabilities against structured serialization.`);
}
