import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import * as actual from "../dist/repository.js";
import * as upstream from "./fixtures/upstream-format7.js";
import { loadRepository } from "../repository-loader.js";
import { RecipeCatalog } from "../recipe-data.js";
import { calculateProduction } from "../production-engine.js";
const manifest = JSON.parse(readFileSync(new URL("../data/manifest.json", import.meta.url)));
const dataset = manifest.datasets.find(value=>value.id === "gtnh-2.9.0");
const bytes = gunzipSync(readFileSync(new URL("../" + dataset.dataUrl, import.meta.url)));
const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length);
const pick = (object, keys) => object ? keys.map(key=>object[key]) : null;
const ids = objects => objects.map(object=>object?.id ?? null);
function goodsProjection(good, kind) {
  const record = pick(good,["id","name","mod","internalName","iconId","tooltip","unlocalizedName","nbt"]);
  record.push([...good.production],[...good.consumption]);
  if (kind === "item") record.push(good.stackSize,good.damage,good.container ? [good.container.fluid.id,good.container.amount,good.container.empty?.id] : null);
  else record.push(good.isGas,[...good.containers]);
  return record;
}
function recipeProjection(recipe) {
  const gt = recipe.gtRecipe;
  return [recipe.id,recipe.recipeType.objectOffset,
    pick(gt,["voltage","durationTicks","amperage","voltageTier","circuitConflicts","specialValue"]),
    gt?.metadata.map(value=>[value.key,value.value]),
    recipe.items.map(io=>[io.type,io.goods.id,io.slot,io.amount,io.probability])];
}
test("all 2.9 goods, recipe IO, machine metadata and remaps agree with the independent pinned upstream parser", () => {
  const repo = new actual.Repository(buffer), reference = new upstream.Repository(buffer);
  assert.equal(repo.dataVersion, 7);
  assert.deepEqual([repo.items.length,repo.fluids.length,repo.recipes.length], [50811,1476,221760]);
  assert.deepEqual(repo.objectPositionMap,reference.objectPositionMap);
  for (const [field,kind,Type,Reference] of [["items","item",actual.Item,upstream.Item],["fluids","fluid",actual.Fluid,upstream.Fluid]]) {
    for (const pointer of repo[field]) assert.deepEqual(goodsProjection(repo.GetObject(pointer,Type),kind),goodsProjection(reference.GetObject(pointer,Reference),kind));
  }
  for (const pointer of repo.oreDicts) assert.deepEqual(ids(repo.GetObject(pointer,actual.OreDict).items),ids(reference.GetObject(pointer,upstream.OreDict).items));
  for (const pointer of repo.recipeTypes) {
    const a=repo.GetObject(pointer,actual.RecipeType), b=reference.GetObject(pointer,upstream.RecipeType);
    assert.deepEqual(pick(a,["name","category","shapeless"]),pick(b,["name","category","shapeless"]));
    assert.deepEqual([...a.dimensions],[...b.dimensions]);
    assert.deepEqual([ids(a.singleblocks),ids(a.multiblocks),a.defaultCrafter?.id],[ids(b.singleblocks),ids(b.multiblocks),b.defaultCrafter?.id]);
  }
  for (const pointer of repo.recipes) {
    const a=repo.GetObject(pointer,actual.Recipe), b=reference.GetObject(pointer,upstream.Recipe);
    assert.deepEqual(recipeProjection(a),recipeProjection(b),a.id);
    delete a.computedIo; delete b.computedIo;
  }
});
test("2.9 cooperative indexing preserves remaps and real calculator quantities without relabeling routes", async () => {
  const reference = new upstream.Repository(buffer);
  const repo = await loadRepository(buffer,{yieldControl:async()=>{}});
  assert.deepEqual(repo.objectPositionMap,reference.objectPositionMap);
  const catalog = new RecipeCatalog(repo,dataset), target="f:gregtech:liquid_epichlorhydrin";
  const result=calculateProduction(catalog,{target,amount:3000,unit:"L",rateMode:"per_minute",depth:1,routeChoices:{[target]:"r~RgUYVgBcPJmt4u3DO2ZYIg=="}});
  assert.equal(result.dataset.id,"gtnh-2.9.0"); assert.equal(result.knownAverageEut,48);assert.equal(result.knownInstalledEut,60);
  assert.equal(result.materials.find(row=>row.name==="Chlorine").amount,100);
  assert.equal(catalog.resolve(target).tooltip,"C₃H₅ClO");
  assert.equal(catalog.resolve("i:minecraft:bucket:0").stackSize,16);
  const metal="i:gregtech:gt.metaitem.01:12393", route="r~--l7UvQdPwieyDfV6NjffQ==";
  const options={target:metal,amount:1,depth:1,routeChoices:{[metal]:route}};
  const base=calculateProduction(catalog,options);
  const heat=calculateProduction(catalog,{...options,machineConfigs:{[route]:{model:"ebf",ruleset:"gt5-5.09.54.205",voltageTier:6,coilLevel:8}}});
  assert.equal(heat.dataset.id,"gtnh-2.9.0"); assert.equal(heat.root.performance.ruleset,"gt5-5.09.54.205");
  assert.equal(heat.root.performance.machineHeat,7601); assert.equal(heat.root.performance.durationTicks,345);
  assert.equal(heat.root.performance.eut,27725); assert.equal(heat.knownEnergy,9565125);
  assert.deepEqual(heat.materials,base.materials); assert.deepEqual(heat.reusable,base.reusable);
});
test("unsupported binary formats fail before any repository is published", () => {
  const invalid=new ArrayBuffer(32);new Int32Array(invalid)[0]=6;
  assert.throws(()=>new actual.Repository(invalid),/Unsupported data version: 6/);
});
