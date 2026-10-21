import {test} from "node:test";
import assert from "node:assert/strict";
import {recipePermalink} from "../recipe-links.js";
import {filterRecipeEntries,recipeBrowseEntry} from "../recipe-browse.js";
test("recipe links keep the Pages subpath, exact version/IDs and discard unrelated plan data",()=>{
 const href=recipePermalink("https://example.com/gtnhnei/?lunaloves=1&ref=old#plan=v1.private",{datasetId:"gtnh-2.9.0",goodId:"i:Mod:Case:0",mode:"Usage",recipeId:"r~Aa+/="});
 const url=new URL(href); assert.equal(url.pathname,"/gtnhnei/");assert.equal(url.hash,"");
 assert.deepEqual([...url.searchParams],[["dataset","gtnh-2.9.0"],["item","i:Mod:Case:0"],["view","usage"],["recipe","r~Aa+/="]]);
});
test("item links do not retain a previous recipe and exact recipe selection preserves case",()=>{
 const href=recipePermalink("https://example.com/?recipe=previous",{datasetId:"v",goodId:"f:fluid"});assert.equal(new URL(href).searchParams.has("recipe"),false);
 const records=["r~Aa","r~aa"].map(id=>({id,machine:"Assembler",inputs:[],outputs:[]})).map(recipeBrowseEntry);
 assert.deepEqual(filterRecipeEntries(records,{query:"r~Aa",exactRecipeId:"r~Aa"}).map(row=>row.recipe.id),["r~Aa"]);
});
