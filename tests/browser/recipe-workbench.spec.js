import { test, expect } from "@playwright/test";
const epi = "f:gregtech:liquid_epichlorhydrin", iron = "i:minecraft:iron_ingot:0", route = "r~7CR1mklsMhyejhfODug_QQ==";
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("gtnhnei_help_seen", "1"));
  await page.goto(`./?item=${encodeURIComponent(epi)}`);
  await expect(page.locator('#bootLoader[data-state="ready"]')).toBeAttached();
  await expect(page.locator("#recipePage .recipe").first()).toBeVisible();
});
test("real recipe filters combine voltage, ingredient IDs and ordering without losing navigation", async ({ page }) => {
  await page.locator("#recipeWorkbench > summary").click();
  await page.locator("#recipeFind").fill("chlorine");
  const count = await page.evaluate(() => window.GTNH_CATALOG.recipes(window.GTNH_CATALOG.resolve("f:gregtech:liquid_epichlorhydrin")).filter(r => [r.id,r.machine,...r.inputs.flatMap(io=>[io.id,io.name]),...r.outputs.flatMap(io=>[io.id,io.name])].join(" ").toLowerCase().includes("chlorine")).length);
  expect(count).toBeGreaterThan(0); await expect(page.locator("#status")).toContainText(`${count}/`);
  await page.locator("#recipeOrdering").selectOption("voltage");
  const voltages = await page.locator("#recipePage .recipe").evaluateAll(cards => cards.map(card => {
    const raw = window.GTNH_CATALOG.repository.GetById(card.dataset.recipeId); return raw.gtRecipe?.voltage ?? Infinity;
  }));
  expect(voltages).toEqual([...voltages].sort((a,b)=>a-b));
  await page.locator("#recipeMaxVoltage").selectOption("8"); await expect(page.locator("#recipePage .empty")).toContainText("No recipes match");
  await page.locator("#recipeFilterReset").click(); await expect(page.locator("#recipePage .recipe").first()).toBeVisible();
  await page.locator("#recipeWorkbench > summary").click();
  await page.locator("#toggleRecipeView").click(); await expect(page.locator("#status")).toContainText("Usage:");
  await expect(page.locator("[data-plan-recipe]")).toHaveCount(0);
  await page.locator("#toggleRecipeView").click(); await expect(page.locator("#status")).toContainText("Production:");
  await page.locator("#search").fill("iron"); await expect(page.locator("#recipeWorkbench")).toBeHidden();
});
test("a real chosen recipe starts an exact plan and the previous factory draft survives reload", async ({ page }) => {
  const original = await page.evaluate(async ({ iron, epi }) => {
    const state = window.GTNH_CALC.getState(); Object.assign(state,{target:iron,amount:17,additionalTargets:[{target:epi,amount:3,unit:"L",machineCount:1}],inventory:{[iron]:5}});
    const { serializePlan } = await import(window.GTNH_MODULE_URL("./planner-state.js"));
    window.GTNH_CALC.import(serializePlan(state,window.GTNH_CATALOG.dataset)); return window.GTNH_CALC.getState();
  }, {iron,epi});
  await page.locator(`[data-plan-recipe="${route}"]`).click();
  expect(await page.evaluate(id=>window.GTNH_CALC.getState().routeChoices[id],epi)).toBe(route);
  expect(await page.evaluate(()=>window.GTNH_CALC.getPlan().knownEnergy)).toBe(19200);
  await page.locator('[data-calc-tab="planner"]').click(); await expect(page.locator("#calculatorRecipeBackup")).toBeVisible();
  await page.reload(); await expect(page.locator('#bootLoader[data-state="ready"]')).toBeAttached();
  await page.locator("#toolCalc").click(); await page.locator('[data-calc-tab="planner"]').click();
  await page.locator("#calculatorRestoreRecipeDraft").click();
  expect(await page.evaluate(()=>window.GTNH_CALC.getState())).toEqual(original);
});
