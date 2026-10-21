import { test } from "node:test";
import assert from "node:assert/strict";
import { filterPlanMaterials, filterPlanNodes } from "../plan-result-filters.js";
test("material views keep native units, duplicate identities, quantities and original ordering", () => {
  const rows = [{id:"f:acid",name:"Acid",type:"fluid",unit:"L",amount:1000}, {id:"i:ingot:2",name:"Ingot",type:"item",amount:2}, {id:"i:ingot:1",name:"Ingot",type:"item",amount:3}];
  const before = structuredClone(rows);
  assert.deepEqual(filterPlanMaterials(rows,{type:"item"}).map(row=>row.id),["i:ingot:1","i:ingot:2"]);
  assert.deepEqual(filterPlanMaterials(rows,{query:"F:ACID"}),[rows[0]]);
  assert.equal(filterPlanMaterials(rows,{type:"fluid",query:"ingot"}).length,0);
  assert.deepEqual(rows,before);
});
test("dependency search covers the complete plan before display limits and retains branch keys", () => {
  const nodes=Array.from({length:600},(_,key)=>({key,parent:key-1,id:`i:${key}`,name:`Node ${key}`,status:key===550?"choose-route":"produced",machine:"Assembler"}));
  assert.deepEqual(filterPlanNodes(nodes,{query:"i:550"}),[nodes[550]]);
  assert.deepEqual(filterPlanNodes(nodes,{attentionOnly:true}),[nodes[550]]);
  assert.equal(filterPlanNodes(nodes,{query:"ASSEMBLER"}).length,600);
  assert.equal(filterPlanNodes(nodes,{query:"missing",attentionOnly:true}).length,0);
  assert.equal(nodes[550].parent,549);
});
