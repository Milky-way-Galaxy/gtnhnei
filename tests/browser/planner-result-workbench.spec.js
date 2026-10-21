import { test, expect } from "@playwright/test";
const target="f:gregtech:liquid_epichlorhydrin", recipe="r~7CR1mklsMhyejhfODug_QQ==";
test.beforeEach(async ({page})=>{
 await page.addInitScript(()=>localStorage.setItem("gtnhnei_help_seen","1"));
 await page.goto("./"); await expect(page.locator('#bootLoader[data-state="ready"]')).toBeAttached();
 await page.evaluate(({target,recipe})=>window.GTNH_CALC.planRecipe(target,recipe),{target,recipe});
});
test("material search and fluid filters keep calculations and exports unchanged",async({page},info)=>{
 const before=await page.evaluate(()=>({state:window.GTNH_CALC.getState(),plan:window.GTNH_CALC.getPlan(),yaml:window.GTNH_CALC.exportYaml()}));
 await page.locator('[data-result-jump="plannerMaterialsSection"]').click(); await expect(page.locator("#plannerMaterialsSection")).toBeFocused();
 await expect(page.locator('[data-result-jump="plannerDiagramSection"]')).toHaveText("Diagram");
 const close=await page.locator("#gtnhCalcClose").boundingBox(); expect(close.y).toBeGreaterThanOrEqual(0);
 await page.locator("#plannerMaterialType").selectOption("fluid");
 const fluids=before.plan.materials.filter(row=>row.type==="fluid"); expect(fluids.length).toBeGreaterThan(0);
 await expect(page.locator("#plannerMaterialRows tbody tr")).toHaveCount(fluids.length);
 await page.locator("#plannerMaterialFind").fill(fluids[0].id); await expect(page.locator("#plannerMaterialRows tbody tr")).toHaveCount(1);
 await expect(page.locator("#plannerMaterialMatches")).toContainText(`1 of ${before.plan.materials.length}`);
 expect(await page.locator("#plannerMaterialRows .plannerGoodIcon").evaluate(el=>getComputedStyle(el).backgroundImage)).toContain("atlas");
 await page.screenshot({path:info.outputPath("materials-workbench.png")});
 await page.locator("#plannerMaterialFind").fill("cannot-match-this-material"); await expect(page.locator("#plannerMaterialRows")).toContainText("complete calculation and exports are unchanged");
 await page.locator("#plannerMaterialReset").click(); await expect(page.locator("#plannerMaterialRows tbody tr")).toHaveCount(before.plan.materials.length);
 expect(await page.evaluate(()=>({state:window.GTNH_CALC.getState(),plan:window.GTNH_CALC.getPlan(),yaml:window.GTNH_CALC.exportYaml()}))).toEqual(before);
});
test("dependency views search real IDs and preserve expansion controls without recomputation",async({page})=>{
 const before=await page.evaluate(()=>window.GTNH_CALC.getPlan());
 await page.locator('[data-result-jump="plannerRoutesSection"]').click(); await expect(page.locator("#plannerRoutesSection")).toBeFocused();
 await page.locator('[data-node-expansion="closed"]').click(); await expect(page.locator(".plannerNodes details[open]")).toHaveCount(0);
 await page.locator('[data-node-expansion="open"]').click(); await expect(page.locator(".plannerNodes details[open]")).toHaveCount(before.nodes.length);
 const child=before.nodes.at(-1); await page.locator("#plannerNodeFind").fill(child.id);
 await expect(page.locator(".plannerNodes details")).toHaveCount(before.nodes.filter(node=>node.id===child.id).length);
 await page.locator("#plannerNodeAttention").check(); await expect(page.locator("#plannerNodeMatches")).toContainText("Filtering does not change calculations");
 await page.locator("#plannerNodeReset").click(); await expect(page.locator(".plannerNodes details")).toHaveCount(before.nodes.length);
 expect(await page.evaluate(()=>window.GTNH_CALC.getPlan())).toEqual(before);
});
test("diagnostic review clears a hiding tree filter and navigation fits a 320px screen",async({page})=>{
 await page.evaluate(async()=>{
  const state=window.GTNH_CALC.getState(); state.routeChoices={};
  const {serializePlan}=await import(window.GTNH_MODULE_URL("./planner-state.js"));
  window.GTNH_CALC.import(serializePlan(state,window.GTNH_CATALOG.dataset));
 });
 await page.setViewportSize({width:320,height:640});
 await page.locator('[data-result-jump="plannerRoutesSection"]').click(); await page.locator("#plannerNodeFind").fill("missing-node");
 await expect(page.locator(".plannerNodes details")).toHaveCount(0);
 await page.locator(".plannerDiagnostics [data-review-node]").first().click();
 await expect(page.locator("#plannerNodeFind")).toHaveValue(""); await expect(page.locator(".plannerNodes summary").first()).toBeFocused();
 const overflow=await page.locator('[data-calc-panel="tree"]').evaluate(el=>el.scrollWidth>el.clientWidth+1); expect(overflow).toBe(false);
 await page.locator('[data-result-jump="plannerOverview"]').click(); await expect(page.locator("#plannerOverview")).toBeFocused();
 await page.locator('[data-result-jump="plannerDiagramSection"]').click();
 await expect(page.locator("#plannerDiagramSection")).toBeFocused();
 await expect(page.locator("#gtnhFlowBrowserPanel")).toHaveCount(0);
 const close=await page.locator("#gtnhCalcClose").boundingBox(); expect(close.y).toBeGreaterThanOrEqual(0);
 expect(await page.locator(".gtnhCalcPanel").evaluate(el=>el.scrollTop)).toBe(0);
});
