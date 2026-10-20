import {test} from "node:test";
import assert from "node:assert/strict";
import {compareRecipes} from "../recipe-compare.js";
const io=(id,amount=1,probability=1)=>({id,type:"item",slot:0,amount,probability});
const recipe=(id,patch={})=>({id,machine:"Macerator",inputs:[io("i:ore")],outputs:[io("i:dust",2)],durationTicks:200,voltage:30,amperage:1,metadata:[],...patch});
test("exporter ID changes do not masquerade as recipe additions and removals",()=>{
  const result=compareRecipes([recipe("old")],[recipe("new")]);assert.equal(result.unchanged.length,1);assert.equal(result.added.length,0);assert.equal(result.removed.length,0);
});
test("a uniquely matched topology detects quantity, chance, power, duration and metadata changes",()=>{
  for(const patch of [{durationTicks:100},{voltage:120},{amperage:2},{inputs:[io("i:ore",2)]},{outputs:[io("i:dust",2,.5)]},{metadata:[{key:"heat",value:1800}]},{specialValue:5},{circuitConflicts:1}]) {
    const result=compareRecipes([recipe("a")],[recipe("a",patch)]);assert.equal(result.modified.length,1);assert.equal(result.unchanged.length,0);
  }
});
test("new ingredients and machines are additions/removals, ambiguous alternatives are never paired arbitrarily",()=>{
  for(const patch of [{machine:"Pulverizer"},{inputs:[io("i:other")]}]) {
    const result=compareRecipes([recipe("a")],[recipe("b",patch)]);assert.equal(result.modified.length,0);assert.equal(result.added.length,1);assert.equal(result.removed.length,1);
  }
  const result=compareRecipes([recipe("a"),recipe("b",{durationTicks:100})],[recipe("c",{durationTicks:50}),recipe("d",{durationTicks:20})]);
  assert.equal(result.modified.length,0);assert.equal(result.added.length,2);assert.equal(result.removed.length,2);
});
test("comparison preserves duplicate multiplicity and ignores record/IO/metadata ordering",()=>{
  const a=recipe("a",{inputs:[io("i:ore"),io("i:tool",0)],metadata:[{key:"z",value:1},{key:"a",value:2}]}),b=structuredClone(a);
  b.id="b";b.inputs.reverse();b.metadata.reverse();
  const result=compareRecipes([a],[b,b]);assert.equal(result.unchanged.length,1);assert.equal(result.added.length,1);
});
test("shapeless IO slot order is ignored while shaped crafting positions remain significant",()=>{
  const a=recipe("a",{shapeless:true}),b=recipe("b",{shapeless:true,inputs:[{...io("i:ore"),slot:1}]});
  assert.equal(compareRecipes([a],[b]).unchanged.length,1);
  a.shapeless=b.shapeless=false;assert.equal(compareRecipes([a],[b]).added.length,1);
});
