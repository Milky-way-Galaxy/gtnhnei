import {test,expect} from "@playwright/test";
test.beforeEach(async({page})=>{await page.addInitScript(()=>localStorage.setItem("gtnhnei_help_seen","1"));});
test("route choices display real net yields/energy and automatic mode reports installed capacity",async({page})=>{
  const target="f:gregtech:liquid_epichlorhydrin";
  await page.goto("./");await expect(page.locator('#bootLoader[data-state="ready"]')).toBeAttached();await page.locator("#toolCalc").click();
  await page.locator("#calcTarget").fill(target);await page.locator("#calcAmount").fill("3000");await page.locator("#calcUnit").selectOption("L");await page.locator("#calcRateMode").selectOption("per_minute");await page.locator("#calcBuild").click();
  const route=page.locator(`select[data-route-good="${target}"]`).first();await expect(route.locator('option[value="r~7CR1mklsMhyejhfODug_QQ=="]')).toContainText("net 1,000 L/batch");
  await expect(route.locator('option[value="r~7CR1mklsMhyejhfODug_QQ=="]')).toContainText("19.2 EU/L");
  await route.selectOption("r~7CR1mklsMhyejhfODug_QQ==");await expect(page.locator("#calcTree")).toContainText("Installed root recipe capacity (2 machines): 62.5 L/s");
  await page.locator('[data-calc-tab="planner"]').click();await page.locator("#calcRouteMode").selectOption("lowest_energy");
  await page.getByText("Supply and expansion settings",{exact:true}).click();
  await page.locator("#plannerResetChoices").click();await page.locator("#calcBuild").click();
  expect(await page.evaluate(()=>window.GTNH_CALC.getPlan().root.machine)).toBe("Fluid Canner");
  expect(await page.evaluate(()=>window.GTNH_CALC.getState().routeMode)).toBe("lowest_energy");
});
test("real blast-furnace metadata and energy appear in recipe cards, embedded cards and planner machine details",async({page})=>{
  const target="i:gregtech:gt.metaitem.01:12393",route="r~--l7UvQdPwieyDfV6NjffQ==";
  await page.goto(`./?item=${encodeURIComponent(target)}`);await expect(page.locator('#bootLoader[data-state="ready"]')).toBeAttached();
  const card=page.locator(`[data-recipe-id="${route}"]`).first();await card.locator(".recipeDetails summary").click();await expect(card.locator(".recipeDetails")).toContainText("coil_heat");await expect(card.locator(".recipeDetails")).toContainText("5400");await expect(card.locator(".recipeDetails")).toContainText("10,598,400 EU");
  const mounted=await page.evaluate(({target,route})=>{const c=window.GTNH_CATALOG,index=c.recipes(c.resolve(target)).findIndex(r=>r.id===route),mount=document.createElement("div");mount.id="metadataCardTest";document.body.appendChild(mount);return window.GTNHNEI_LIVE_RECIPE_CARD_API.mountProduction(target,index,mount);},{target,route});expect(mounted).toBe(true);
  await expect(page.locator("#metadataCardTest .recipeDetails")).toContainText("coil_heat");
  await page.locator("#planCurrentItem").click();await page.locator(`select[data-route-good="${target}"]`).first().selectOption(route);
  await expect(page.locator("#calcTree")).toContainText("10,598,400 EU");await expect(page.locator("#calcTree")).toContainText("machine-specific conditions");
  const profile=page.locator(".plannerProfile").first();await profile.locator("..").locator(":scope > summary").click();
  await profile.locator("..").locator(".plannerRecipeMetadata > summary").click();await expect(profile.locator("..").locator(".plannerRecipeMetadata")).toContainText("coil_heat");
});
