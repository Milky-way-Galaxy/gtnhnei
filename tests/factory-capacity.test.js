import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateFactory, calculateProduction } from "../production-engine.js";
import { normalizePlannerState, serializePlan, importPlan } from "../planner-state.js";
import { machinesCsv } from "../recipe-export.js";
const io = (id, amount=1) => ({ id, name:id, type:"item", unit:"items", amount, probability:1 });
const recipe = (id, inputs, output, extra={}) => ({id, machine:"Mixer", inputs, outputs:[io(output)], durationTicks:200, eut:30, ...extra});
function fixture(records) {
  const goods = new Map(records.flatMap(r => [...r.inputs,...r.outputs]).map(g=>[g.id,g]));
  return {dataset:{id:"test"},resolve:id=>goods.get(id),describe:good=>good,recipes:good=>records.filter(r=>r.outputs.some(io=>io.id===good.id))};
}
const catalog = fixture([
  recipe("a",[io("part",2)],"first",{durationTicks:100}), recipe("b",[io("part")],"second"),
  recipe("shared",[io("raw"),io("circuit",0)],"part")
]);
const options = {targets:[{target:"first",amount:1},{target:"second",amount:1}],depth:"full",routeMode:"ask",rateMode:"per_second"};
test("factory bottlenecks use combined shared-recipe demand and scale the output mix together", () => {
  const result = calculateFactory(catalog,{...options,machineConfigs:{a:{installedMachines:10},b:{installedMachines:20},shared:{installedMachines:10}}});
  const analysis=result.capacityAnalysis, shared=result.steps.find(step=>step.recipeId==="shared");
  assert.equal(shared.count,30); assert.equal(shared.equivalents,30); assert.equal(shared.installedCount,10);
  assert.equal(analysis.rateFactor,1/3); assert.deepEqual(analysis.limitingRecipeIds,["shared"]);
  assert.deepEqual(analysis.targets.map(target=>target.capacity),[1/3,1/3]);
  assert.equal(analysis.rows.find(row=>row.recipeId==="shared").utilization,3);
  assert.equal(result.materials.find(row=>row.id==="raw").amount,3);
  assert.equal(result.reusable.find(row=>row.id==="circuit").amount,10);
  assert.equal(result.knownAverageEut,1350); assert.equal(result.knownInstalledEut,1200);
  assert.match(result.warnings.join(" "),/requested production exceeds/);
});
test("different recipes using one machine type retain separate pools and tied limiting stages", () => {
  const result=calculateFactory(catalog,{...options,machineConfigs:{a:{installedMachines:5},b:{installedMachines:10},shared:{installedMachines:60}}});
  assert.equal(result.capacityAnalysis.rows.length,3);
  assert.equal(result.capacityAnalysis.rateFactor,1);
  assert.deepEqual(result.capacityAnalysis.limitingRecipeIds,["a","b"]);
});
test("recipe overrides take precedence over fixed root pools, and clearing restores each default", () => {
  const c=fixture([recipe("a",[io("raw"),io("circuit",0)],"first")]);
  const opts={target:"first",amount:.16,rateMode:"per_second",machineMode:"fixed",machineCount:3};
  const fixed=calculateProduction(c,opts), custom=calculateProduction(c,{...opts,machineConfigs:{a:{installedMachines:1}}});
  assert.equal(fixed.steps[0].installedCount,3); assert.equal(fixed.steps[0].installedSource,"root");
  assert.equal(custom.steps[0].count,2); assert.equal(custom.steps[0].installedCount,1); assert.equal(custom.steps[0].installedSource,"recipe");
  assert.equal(custom.targets[0].installedCapacity,.1); assert.ok(Math.abs(custom.capacityAnalysis.rateFactor-.625)<1e-12);
  assert.equal(custom.reusable[0].amount,1); assert.equal(custom.knownInstalledEut,30);
  const auto=calculateProduction(c,{...opts,machineMode:"auto"});
  assert.equal(auto.steps[0].installedCount,2); assert.equal(auto.steps[0].installedSource,"auto");
});
test("a zero machine count stops the mix, needs no installed power/stock, and survives JSON", () => {
  const c=fixture([recipe("a",[io("raw"),io("circuit",0)],"first")]);
  const result=calculateProduction(c,{target:"first",amount:.2,rateMode:"per_second",machineConfigs:{a:{installedMachines:0}}});
  assert.equal(result.capacityAnalysis.rateFactor,0); assert.equal(result.capacityAnalysis.targets[0].capacity,0);
  assert.equal(result.capacityAnalysis.rows[0].utilization,null);
  assert.equal(result.knownInstalledEut,0); assert.equal(result.knownAverageEut,60); assert.deepEqual(result.reusable,[]);
  const dataset={id:"test",sha256:"hash"}, state=normalizePlannerState({machineConfigs:{a:{installedMachines:0}}});
  assert.equal(importPlan(serializePlan(state,dataset),dataset).machineConfigs.a.installedMachines,0);
  for(const installedMachines of [-1,.5,Infinity,1000001]) assert.throws(()=>normalizePlannerState({machineConfigs:{a:{installedMachines}}}));
});
test("unknown timing and unresolved routes remain partial; total jobs do not invent a factory schedule", () => {
  const c=fixture([recipe("a",[io("part")],"first"),recipe("b",[io("raw")],"part",{durationTicks:null,eut:null})]);
  const result=calculateProduction(c,{target:"first",amount:.2,rateMode:"per_second",depth:"full",machineConfigs:{a:{installedMachines:1}}});
  assert.equal(result.capacityAnalysis.unknownStages,1); assert.equal(result.capacityAnalysis.rateFactor,.5);
  assert.equal(result.capacityAnalysis.rows.find(row=>row.recipeId==="b").capacityFactor,null);
  const stopped=calculateProduction(c,{target:"first",amount:.2,rateMode:"per_second",depth:"full",machineConfigs:{b:{installedMachines:0}}});
  assert.equal(stopped.capacityAnalysis.rateFactor,0); assert.equal(stopped.capacityAnalysis.unknownStages,1);
  assert.equal(stopped.capacityAnalysis.rows.find(row=>row.recipeId==="b").batchesPerSecond,0);
  const unresolved=calculateProduction(c,{target:"first",amount:1,rateMode:"per_second",routeMode:"manual"});
  assert.equal(unresolved.capacityAnalysis.rateFactor,null); assert.equal(unresolved.capacityAnalysis.hasUnresolvedRoutes,true);
  const total=calculateProduction(c,{target:"first",amount:1,machineConfigs:{a:{installedMachines:0}}});
  assert.equal(total.capacityAnalysis,null); assert.equal(total.rootTimeSeconds,10);
});
test("machine CSV reports actual IDs, per-recipe counts and unknown fields without changing the material export", () => {
  const c=fixture([recipe("a",[io("raw")],"first",{machine:'Mixer, "A"'})]);
  const result=calculateProduction(c,{target:"first",amount:.16,rateMode:"per_second",machineConfigs:{a:{installedMachines:1}}});
  const csv=machinesCsv(result);
  assert.match(csv,/"Dataset","Recipe ID","Machine"/);
  assert.match(csv,/"test","a","Mixer, ""A""","generic","","0.16","200","1","30","2","1","recipe","1.5999999999999999","true","30",""/);
  const unknown=calculateProduction(fixture([recipe("u",[],"first",{eut:null,durationTicks:null})]),{target:"first",amount:1,rateMode:"per_second"});
  assert.doesNotMatch(machinesCsv(unknown),/NaN|Infinity|undefined|null/);
});
