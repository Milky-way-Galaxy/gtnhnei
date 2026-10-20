import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { Repository } from "../dist/repository.js";
import { RecipeCatalog } from "../recipe-data.js";
import { exportRecipeYaml, exportPlanYaml } from "../recipe-export.js";
import { calculateProduction, calculateFactory, machinePerformance, ceilPositive, recipeMetrics, selectRecipe } from "../production-engine.js";

const good = (id, type = "item") => ({ id, name: id, type, unit: type === "fluid" ? "L" : "items", amount: 1, probability: 1 });
const io = (id, amount, probability = 1) => ({ ...good(id), amount, probability });
const recipe = (id, inputs, outputs, extra = {}) => ({ id, machine: id, inputs, outputs, durationTicks: 200, eut: 30, voltage: 30, amperage: 1, ...extra });
function fixture(records, goods = []) {
  const all = new Map(goods.map(g => [g.id, g]));
  for (const r of records) for (const g of [...r.inputs, ...r.outputs]) all.set(g.id, g);
  return { dataset: { id: "test" }, resolve: id => all.get(id), describe: g => ({ ...g }),
    recipes: g => records.filter(r => r.outputs.some(io => io.id === g.id)), matches: () => [] };
}
const options = { target: "product", amount: 1, depth: "full", routeMode: "lowest_tier" };
test("recursive quantities aggregate shared raw resources and round whole crafts", () => {
  const catalog = fixture([recipe("a", [io("part", 3)], [io("product", 2)]), recipe("b", [io("raw", 2)], [io("part", 2)])]);
  const result = calculateProduction(catalog, { ...options, amount: 5 });
  assert.equal(result.root.batches, 3);
  assert.equal(result.materials[0].amount, 10);
  assert.equal(result.byproducts.find(row => row.id === "product").amount, 1);
  assert.equal(result.byproducts.find(row => row.id === "part").amount, 1);
});
test("continuous rates use fractional batches, machine counts, average and installed EU/t", () => {
  const catalog = fixture([recipe("a", [io("raw", 3)], [io("product", 2)])]);
  const result = calculateProduction(catalog, { ...options, amount: 18, rateMode: "per_minute" });
  assert.equal(result.requested, .3);
  assert.equal(result.steps[0].batches, .15);
  assert.equal(result.steps[0].count, 2);
  assert.ok(Math.abs(result.knownAverageEut - 45) < 1e-10);
  assert.equal(result.knownInstalledEut, 60);
  assert.ok(Math.abs(result.materials[0].amount - .45) < 1e-12);
});
test("expected chance output is applied without claiming guaranteed production", () => {
  const result = calculateProduction(fixture([recipe("a", [io("raw", 1)], [io("product", 1, .25)])]), options);
  assert.equal(result.root.batches, 4);
  assert.equal(result.materials[0].amount, 4);
  assert.match(result.warnings.join(" "), /not guaranteed/);
});
test("cycles are stopped by identity even when each iteration changes the amount", () => {
  const result = calculateProduction(fixture([recipe("a", [io("b", 2)], [io("product", 1)]), recipe("b", [io("product", 3)], [io("b", 1)])]), options);
  assert.equal(result.nodes.length, 3);
  assert.equal(result.materials[0].id, "product");
  assert.equal(result.materials[0].amount, 6);
  assert.equal(result.unresolved[0].reason, "cycle");
});
test("autocatalytic recipes use net output and preserve required seed stock", () => {
  const result = calculateProduction(fixture([recipe("a", [io("product", 1), io("feed", 2)], [io("product", 3)])]), { ...options, amount: 4 });
  assert.equal(result.root.batches, 2);
  assert.equal(result.reusable[0].amount, 1);
  assert.equal(result.materials[0].amount, 4);
});
test("consumed empty cells remain requirements; returned cells and zero-amount circuits are stock", () => {
  const result = calculateProduction(fixture([recipe("a", [io("empty cell", 3), io("circuit", 0)], [io("product", 1), io("empty cell", 1)])]), options);
  assert.equal(result.materials.find(row => row.id === "empty cell").amount, 2);
  assert.equal(result.reusable.find(row => row.id === "circuit").amount, 1);
  assert.equal(result.reusable.find(row => row.id === "empty cell").amount, 1);
});
test("ask mode and invalid locked recipe IDs produce unresolved inputs", () => {
  const catalog = fixture([recipe("a", [io("raw", 1)], [io("product", 1)]), recipe("b", [io("raw", 2)], [io("product", 1)])]);
  assert.equal(calculateProduction(catalog, { ...options, routeMode: "ask" }).unresolved[0].reason, "choose-route");
  assert.equal(calculateProduction(catalog, { ...options, routeChoices: { product: "missing" } }).unresolved[0].reason, "invalid-route");
  assert.equal(calculateProduction(catalog, { ...options, routeChoices: { product: "b" } }).materials[0].amount, 2);
});
test("manual route mode only executes explicitly chosen recipes, including a sole route", () => {
  const c = fixture([recipe("a", [io("raw", 1)], [io("product", 1)])]);
  assert.equal(calculateProduction(c, { ...options, routeMode: "manual" }).unresolved[0].reason, "choose-route");
  assert.equal(calculateProduction(c, { ...options, routeMode: "manual", routeChoices: { product: "a" } }).root.batches, 1);
});
test("missing timing does not invent machine count or energy", () => {
  const result = calculateProduction(fixture([recipe("crafting", [io("raw", 1)], [io("product", 1)], { durationTicks: null, eut: null })]), { ...options, rateMode: "per_second" });
  assert.equal(result.steps[0].count, null);
  assert.equal(result.hasUnknownPower, true);
});
test("normal/perfect overclocks use 4x EU, 2x/4x speed, tick truncation and parallel lanes", () => {
  const record = recipe("a", [], [], { durationTicks: 25 });
  assert.deepEqual(machinePerformance(record, { overclocks: 1, parallels: 2 }), { durationTicks: 12, parallels: 2, laneEut: 120, eut: 240, batchesPerSecond: 40 / 12 });
  assert.equal(machinePerformance(record, { overclocks: 3, overclockMode: "perfect" }).durationTicks, 1);
  assert.throws(() => machinePerformance(record, { parallels: 0 }));
});
test("node budgets retain boundary materials rather than dropping quantities", () => {
  const records = Array.from({ length: 30 }, (_, i) => recipe(`recipe${i}`, [io(`g${i + 1}`, 1)], [io(i === 0 ? "product" : `g${i}`, 1)]));
  const result = calculateProduction(fixture(records), { ...options, nodeLimit: 10 });
  assert.equal(result.nodes.length, 10);
  assert.equal(result.materials[0].amount, 1);
  assert.equal(result.truncated, true);
});
test("invalid quantities and item/fluid units are rejected", () => {
  const catalog = fixture([recipe("a", [], [io("product", 1)])]);
  for (const amount of [0, -1, NaN, Infinity]) assert.throws(() => calculateProduction(catalog, { ...options, amount }));
  assert.throws(() => calculateProduction(catalog, { ...options, unit: "buckets" }), /fluids/);
});
const data = gunzipSync(readFileSync(new URL("../data/data.bin", import.meta.url)));
const catalog = new RecipeCatalog(Repository.load(data.buffer.slice(data.byteOffset, data.byteOffset + data.length)), { id: "gtnh-2.8.0" });
const epichlorohydrin = catalog.resolve("f:gregtech:liquid_epichlorhydrin");
const routes = catalog.recipes(epichlorohydrin);
const epiOptions = { target: epichlorohydrin.id, amount: 2000, unit: "L", depth: 1, routeChoices: { [epichlorohydrin.id]: "r~7CR1mklsMhyejhfODug_QQ==" } };
test("real epichlorohydrin recipe: 2000 L requires 2 batches, exact materials and 38400 EU", () => {
  const result = calculateProduction(catalog, epiOptions);
  assert.equal(result.root.batches, 2);
  assert.equal(result.materials.find(row => row.name === "Sodium Hydroxide Dust").amount, 6);
  assert.equal(result.materials.find(row => row.name === "Chlorine").amount, 4000);
  assert.equal(result.materials.find(row => row.name === "Mercury").amount, 200);
  assert.equal(result.byproducts.find(row => row.name === "Hydrogen").amount, 4000);
  assert.equal(result.knownEnergy, 38400);
  assert.equal(result.rootTimeSeconds, 64);
  assert.equal(result.reusable.find(row => row.name === "Programmed Circuit").amount, 1);
});
test("real epichlorohydrin throughput: 3000 L/min needs 1.6 base machines, 48 average/60 installed EU/t", () => {
  const result = calculateProduction(catalog, { ...epiOptions, amount: 3000, rateMode: "per_minute" });
  assert.equal(result.requested, 50);
  assert.equal(result.steps[0].equivalents, 1.6);
  assert.equal(result.steps[0].count, 2);
  assert.equal(result.knownAverageEut, 48);
  assert.equal(result.knownInstalledEut, 60);
  assert.equal(result.capacity, 31.25);
  assert.equal(result.targets[0].installedCount, 2);
  assert.equal(result.targets[0].installedCapacity, 62.5);
});
test("real data bucket conversion, stable recipe IDs and structured metadata remain exact", () => {
  const result = calculateProduction(catalog, { ...epiOptions, amount: 3, unit: "buckets" });
  assert.equal(result.requested, 3000);
  assert.equal(result.root.batches, 3);
  assert.equal(routes[0].durationTicks, 640);
  assert.equal(routes[0].inputs.find(io => io.name === "Programmed Circuit").amount, 0);
  assert.equal(catalog.resolve("i:minecraft:iron_ingot:0").name, "Iron Ingot");
});
test("native stack conversion follows real GTNH records, including 16-stack buckets and unstackable tools", () => {
  for (const [id, size] of [["i:minecraft:iron_ingot:0", 64], ["i:minecraft:bucket:0", 16], ["i:minecraft:diamond_pickaxe:0", 1], ["i:minecraft:ender_pearl:0", 64]]) {
    const result = calculateProduction(catalog, { target: id, amount: 2, unit: "stacks", externalInputs: [id] });
    assert.equal(result.requested, size * 2);
    assert.equal(result.target.stackSize, size);
  }
  assert.throws(() => calculateProduction(catalog, { ...epiOptions, unit: "stacks" }), /known native stack size/);
});

test("parallel circuits are one per machine while returned seed materials are per lane", () => {
  const record = recipe("a", [io("circuit",0), io("seed",1)], [io("product",1), io("seed",1)]);
  const result = calculateProduction(fixture([record]), { ...options, machineConfigs: { a: { parallels: 4 } } });
  assert.equal(result.reusable.find(row=>row.id==="circuit").amount,1);
  assert.equal(result.reusable.find(row=>row.id==="seed").amount,4);
});
test("small positive target quantities still require a whole recipe execution", () => {
  const catalog = fixture([recipe("a", [io("raw",1)], [io("product",1e9)])]);
  const result = calculateProduction(catalog, { ...options, amount: .000001 });
  assert.equal(result.root.batches,1);
  assert.equal(result.materials[0].amount,1);
});
test("very small continuous consumption is retained rather than silently discarded", () => {
  const catalog = fixture([recipe("a", [io("raw",1)], [io("product",1e9)])]);
  const result = calculateProduction(catalog, { ...options, amount: .000001, rateMode:"per_second" });
  assert.ok(result.materials[0].amount > 0);
  assert.equal(result.steps[0].count, 1);
  assert.equal(result.knownInstalledEut, 30);
});

test("unknown crafting duration/power is never exported as an invented executable recipe", () => {
  const result=exportRecipeYaml(catalog,"i:minecraft:iron_ingot:0",0);
  assert.equal(result.ok,false);
  assert.match(result.error,/not available/);
  assert.ok(!result.yaml.includes("eut:"));
  assert.ok(!result.yaml.includes("dur:"));
});
test("flow exports preserve distinct IDs even when different fluids share the same name", () => {
  const a={...io("f:moda:steam",1000),name:"Steam",type:"fluid",unit:"L"};
  const b={...io("f:modb:steam",2000),name:"Steam",type:"fluid",unit:"L"};
  const c=fixture([recipe("a",[a,b],[io("product",1)])]);
  const result=calculateProduction(c,options);
  assert.equal(result.materials.length,2);
  const yaml=exportPlanYaml(result);
  assert.match(yaml,/steam \[f:moda:steam\]/);
  assert.match(yaml,/steam \[f:modb:steam\]/);
});
test("flow export disambiguates real item/fluid names that differ only by capitalization", () => {
  const item = catalog.describe(catalog.resolve("i:gregtech:gt.metaitem.02:32001"));
  const fluid = catalog.describe(catalog.resolve("f:gregtech:potion.sweetcoffee"));
  assert.equal(item.name, "Sweet coffee"); assert.equal(fluid.name, "Sweet Coffee");
  const c = fixture([recipe("coffee test", [{ ...item, amount: 1, probability: 1 }, { ...fluid, amount: 1000, probability: 1 }], [io("product", 1)])]);
  const yaml = exportPlanYaml(calculateProduction(c, options));
  assert.match(yaml, /sweet coffee \[i:gregtech:gt.metaitem.02:32001\]/);
  assert.match(yaml, /sweet coffee \[f:gregtech:potion.sweetcoffee\]/);
});
test("recipe exports reject ambiguous or partial names instead of picking an arbitrary good", () => {
  const ambiguous = exportRecipeYaml(catalog, "Sweet Coffee", 0);
  assert.equal(ambiguous.ok, false);
  assert.match(ambiguous.error, /Several goods/);
  assert.equal(exportRecipeYaml(catalog, "epichlor", 0).ok, false);
  assert.equal(exportRecipeYaml(catalog, epichlorohydrin.id, 0).ok, true);
});
test("ordinary names and prototype property names never enter the raw ID lookup", () => {
  assert.equal(catalog.resolve("constructor"),null);
  assert.equal(catalog.resolve("__proto__"),null);
  assert.equal(catalog.resolve("toString"),null);
});
test("total-craft processing time schedules whole batch waves across machines", () => {
  const c=fixture([recipe("a",[io("raw",1)],[io("product",1)])]);
  assert.equal(calculateProduction(c,{...options,amount:2,machineCount:3}).rootTimeSeconds,10);
  assert.equal(calculateProduction(c,{...options,amount:3,machineCount:2}).rootTimeSeconds,20);
  assert.equal(calculateProduction(c,{...options,amount:3,machineCount:2,rounding:"fractional"}).rootTimeSeconds,15);
  assert.throws(()=>calculateProduction(c,{...options,machineCount:Infinity}),/machine count/);
});
test("total-craft root stock provisions the requested machine count", () => {
  const c=fixture([recipe("a",[io("circuit",0)],[io("product",1)])]);
  const result=calculateProduction(c,{...options,amount:3,machineCount:2});
  assert.equal(result.reusable[0].amount,2);
});
test("machine ceilings tolerate arithmetic noise while preserving real fractions and tiny demands", () => {
  assert.equal(ceilPositive(1 + Number.EPSILON), 1);
  assert.equal(ceilPositive(1 + 1e-8), 2);
  assert.equal(ceilPositive(1e-16), 1);
});
test("fixed-rate root machines affect installed power and startup stock, retaining required count", () => {
  const result = calculateProduction(catalog, { ...epiOptions, amount: 3000, rateMode: "per_minute", machineMode: "fixed", machineCount: 3 });
  assert.equal(result.steps[0].count, 2);
  assert.equal(result.steps[0].installedCount, 3);
  assert.equal(result.knownAverageEut, 48);
  assert.equal(result.knownInstalledEut, 90);
  assert.equal(result.reusable.find(row => row.name === "Programmed Circuit").amount, 3);
  const limited = calculateProduction(catalog, { ...epiOptions, amount: 3000, rateMode: "per_minute", machineMode: "fixed", machineCount: 1 });
  assert.equal(limited.knownInstalledEut, 30);
  assert.match(limited.warnings.join(" "), /exceeds/);
});
test("finite inventory is shared once across branches before expanding remaining dependencies", () => {
  const c = fixture([
    recipe("root", [io("a", 1), io("b", 1)], [io("product", 1)]),
    recipe("a", [io("shared", 3)], [io("a", 1)]),
    recipe("b", [io("shared", 4)], [io("b", 1)]),
    recipe("shared", [io("raw", 2)], [io("shared", 5)])
  ]);
  const inventory = { shared: 4, raw: 1 };
  const result = calculateProduction(c, { ...options, inventory });
  assert.equal(result.materials.find(row => row.id === "raw").amount, 1);
  assert.equal(result.inventoryUsed.find(row => row.id === "shared").amount, 4);
  assert.equal(result.inventoryUsed.find(row => row.id === "raw").amount, 1);
  assert.equal(result.byproducts.find(row => row.id === "shared").amount, 2);
  assert.equal(result.steps.find(row => row.recipeId === "shared").batches, 1);
  assert.deepEqual(inventory, { shared: 4, raw: 1 });
});
test("stock can satisfy a whole target without selecting a route or creating production", () => {
  const c = fixture([recipe("a", [], [io("product", 1)]), recipe("b", [], [io("product", 2)])]);
  const result = calculateProduction(c, { ...options, routeMode: "ask", amount: 3, inventory: { product: 5 } });
  assert.equal(result.root.status, "from-inventory");
  assert.equal(result.rootTimeSeconds, 0);
  assert.equal(result.materials.length, 0);
  assert.equal(result.steps.length, 0);
  assert.equal(result.inventoryUsed[0].amount, 3);
  assert.equal(result.inventoryRemaining[0].amount, 2);
  assert.equal(result.unresolved.length, 0);
});
test("floating-point subtraction does not invent a batch when stock covers a fractional demand", () => {
  const c = fixture([recipe("a", [io("raw", 0.1 + 0.2)], [io("product", 1)])]);
  const result = calculateProduction(c, { ...options, inventory: { raw: 0.3 } });
  assert.equal(result.materials.length, 0);
  assert.equal(result.inventoryUsed[0].amount, 0.3);
});
test("rate jobs never deduct finite stock; freely supplied inputs do not spend it", () => {
  const c = fixture([recipe("a", [io("raw", 3)], [io("product", 1)])]);
  const result = calculateProduction(c, { ...options, rateMode: "per_second", inventory: { raw: 100 } });
  assert.equal(result.materials[0].amount, 3);
  assert.equal(result.inventoryUsed.length, 0);
  assert.equal(result.inventoryRemaining[0].amount, 100);
  assert.match(result.warnings.join(" "), /not deducted/);
  const free = calculateProduction(c, { ...options, freeInputs: ["raw"], inventory: { raw: 100 } });
  assert.equal(free.materials.length, 0);
  assert.equal(free.inventoryUsed.length, 0);
});
test("real-fluid inventory reduces consumption while leaving tools and rate requirements explicit", () => {
  const chlorine = catalog.goods.find(good => good.name === "Chlorine");
  const result = calculateProduction(catalog, { ...epiOptions, inventory: { [epichlorohydrin.id]: 1000, [chlorine.id]: 1500 } });
  assert.equal(result.root.batches, 1);
  assert.equal(result.root.inventoryUsed, 1000);
  assert.equal(result.materials.find(row => row.name === "Chlorine").amount, 500);
  assert.equal(result.reusable.find(row => row.name === "Programmed Circuit").amount, 1);
  assert.equal(result.knownEnergy, 19200);
});
test("invalid inventory and converted quantities fail visibly", () => {
  for (const inventory of [[], { missing: 1 }, { [epichlorohydrin.id]: -1 }, { [epichlorohydrin.id]: Infinity }]) {
    assert.throws(() => calculateProduction(catalog, { ...epiOptions, inventory }), /[Ii]nventory/);
  }
  assert.throws(() => calculateProduction(catalog, { ...epiOptions, amount: 1e308, unit: "buckets" }), /unit conversion/);
});
test("factory outputs share finite inventory once and combine material/energy ledgers", () => {
  const c = fixture([recipe("a",[io("raw",3)],[io("product",1)]),recipe("b",[io("raw",4)],[io("other",1)])]);
  const result = calculateFactory(c,{...options,targets:[{target:"product",amount:2},{target:"other",amount:3}],inventory:{raw:5}});
  assert.equal(result.targets.length,2);
  assert.equal(result.inventoryUsed[0].amount,5);
  assert.equal(result.materials[0].amount,13);
  assert.equal(result.knownEnergy,30000);
  assert.equal(result.rootTimeSeconds,null);
  assert.deepEqual(result.targets.map(target=>target.timeSeconds),[20,30]);
  assert.equal(result.roots.length,2);
  assert.equal(new Set(result.nodes.map(node=>node.key)).size,result.nodes.length);
});
test("repeated factory outputs combine native demand before whole-batch rounding", () => {
  const c=fixture([recipe("a",[io("raw",3)],[io("product",2)])]);
  const result=calculateFactory(c,{...options,targets:[{target:"product",amount:1},{target:"product",amount:1}]});
  assert.equal(result.targets.length,1); assert.equal(result.root.batches,1); assert.equal(result.materials[0].amount,3);
});
test("factory rates aggregate shared intermediate machines before applying installed-count ceilings", () => {
  const c=fixture([recipe("a",[io("shared",1)],[io("product",1)]),recipe("b",[io("shared",1)],[io("other",1)]),recipe("s",[io("raw",1),io("circuit",0)],[io("shared",1)])]);
  const result=calculateFactory(c,{...options,rateMode:"per_second",targets:[{target:"product",amount:.05},{target:"other",amount:.05}]});
  const shared=result.steps.find(step=>step.recipeId==="s");
  assert.equal(shared.equivalents,1); assert.equal(shared.count,1); assert.equal(shared.installedEut,30);
  assert.equal(result.reusable.find(row=>row.id==="circuit").amount,1);
});
test("earlier co-products satisfy later branches once; future output cannot erase a cycle seed", () => {
  const c=fixture([recipe("root",[io("a",1),io("b",1)],[io("product",1)]),recipe("a",[io("raw",1)],[io("a",1),io("b",1)]),recipe("b",[io("raw",1)],[io("b",1)])]);
  const result=calculateProduction(c,{...options,reuseByproducts:true});
  assert.equal(result.materials[0].amount,1); assert.equal(result.byproductsUsed[0].id,"b");
  assert.equal(result.byproductsUsed[0].amount,1); assert.equal(result.byproducts.some(row=>row.id==="b"),false);
  const loop=fixture([recipe("a",[io("b",1)],[io("product",1),io("co",1)]),recipe("b",[io("product",1)],[io("b",1)])]);
  const cyclic=calculateFactory(loop,{...options,reuseByproducts:true,targets:[{target:"product",amount:1},{target:"co",amount:1}]});
  assert.equal(cyclic.unresolved[0].reason,"cycle");
  assert.equal(cyclic.materials[0].id,"product"); assert.equal(cyclic.materials[0].amount,1);
});
test("real factory co-product demand reuses hydrogen without duplicating the epichlorohydrin reactor", () => {
  const hydrogen=routes[0].outputs.find(io=>io.name==="Hydrogen");
  const result=calculateFactory(catalog,{...epiOptions,rateMode:"per_minute",reuseByproducts:true,targets:[{target:epichlorohydrin.id,amount:3000,unit:"L"},{target:hydrogen.id,amount:6000,unit:"L"}]});
  assert.equal(result.targets[1].root.status,"from-byproduct");
  assert.equal(result.steps.length,1); assert.equal(result.knownAverageEut,48); assert.equal(result.knownInstalledEut,60);
  assert.equal(result.byproductsUsed.find(row=>row.id===hydrogen.id).amount,100);
});
test("factory validation rejects mixed totals/rates, unsafe quantities, conflicting counts and excess targets", () => {
  const c=fixture([recipe("a",[],[io("product",1)]),recipe("b",[],[io("other",1)])]);
  for(const targets of [[],Array(21).fill({target:"product",amount:1}),[{target:"product",amount:1,rateMode:"total"},{target:"other",amount:1,rateMode:"per_second"}],[{target:"product",amount:1,machineCount:1},{target:"product",amount:1,machineCount:2}],[{target:"product",amount:Infinity}]]) assert.throws(()=>calculateFactory(c,{...options,targets}));
});
test("route efficiency uses net expected output and distinguishes EU/t from energy per output",()=>{
  const lowPower=recipe("low-power",[],[io("product",1)],{durationTicks:1000,eut:10}),efficient=recipe("efficient",[],[io("product",2)],{durationTicks:20,eut:30});
  assert.equal(selectRecipe([lowPower,efficient],good("product"),{routeMode:"lowest_eut"}).id,"low-power");
  assert.equal(selectRecipe([lowPower,efficient],good("product"),{routeMode:"lowest_energy"}).id,"efficient");
  assert.equal(recipeMetrics(efficient,good("product")).energyPerOutput,300);
  const autocatalytic=recipe("seeded",[io("product",1)],[io("product",3)]);
  assert.equal(recipeMetrics(autocatalytic,good("product")).output,2);
  assert.equal(recipeMetrics(autocatalytic,good("product")).energyPerOutput,3000);
  const chance=recipe("chance",[],[io("product",1000,.25)]);
  assert.deepEqual(recipeMetrics(chance,good("product")),{output:250,expected:true,outputPerSecond:25,energyPerOutput:24});
  assert.equal(recipeMetrics(recipe("extra",[],[io("product",1),io("other",1,.1)]),good("product")).expected,false);
});
test("automatic scores retain known timing, stable ties, valid legacy indexes and net-positive routes",()=>{
  const unknown=recipe("unknown",[],[io("product",1)],{durationTicks:null,eut:null}),known=recipe("known",[],[io("product",1)]),zero=recipe("no-net",[io("product",1)],[io("product",1)]);
  assert.equal(selectRecipe([unknown,known],good("product"),{routeMode:"lowest_energy"}).id,"known");
  assert.equal(selectRecipe([known,{...known,id:"alpha"}],good("product"),{routeMode:"lowest_energy"}).id,"alpha");
  assert.equal(selectRecipe([zero,known],good("product"),{routeMode:"ask"}).id,"known");
  assert.equal(selectRecipe([zero,known],good("product"),{routeChoices:{product:1}}).id,"known");
  assert.equal(selectRecipe([zero,known],good("product"),{routeChoices:{product:0}}),null);
});
test("installed capacity follows the actual fixed pool while recipe metadata remains explicit",()=>{
  const result=calculateProduction(catalog,{...epiOptions,amount:3000,rateMode:"per_minute",machineMode:"fixed",machineCount:3});
  assert.equal(result.targets[0].installedCount,3);assert.equal(result.targets[0].installedCapacity,93.75);
  const target="i:gregtech:gt.metaitem.01:12393",route="r~--l7UvQdPwieyDfV6NjffQ==";
  const hot=calculateProduction(catalog,{target,amount:1,unit:"items",depth:1,routeChoices:{[target]:route}});
  assert.equal(hot.knownEnergy,10598400);assert.equal(hot.steps[0].recipe.metadata.find(row=>row.key==="coil_heat").value,5400);
  assert.ok(hot.warnings.some(text=>text.includes("machine-specific conditions")));
});
