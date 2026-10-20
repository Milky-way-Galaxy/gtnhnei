import { test, expect } from "@playwright/test";
const target="f:gregtech:liquid_epichlorhydrin";
const route29="r~RgUYVgBcPJmt4u3DO2ZYIg==", route28="r~7CR1mklsMhyejhfODug_QQ==";
test.beforeEach(async ({page})=>{await page.addInitScript(()=>localStorage.setItem("gtnhnei_help_seen","1"));});
async function ready(page) { await expect(page.locator('#bootLoader[data-state="ready"]')).toBeAttached(); }
async function switchTo(page, version) {
  await page.locator("#toolNei").click();
  await page.locator("#gtnhNeiDrop button").filter({hasText:`GTNH ${version}`}).click();
  await expect(page).toHaveURL(new RegExp(`dataset=gtnh-${version.replaceAll(".","\\.")}`));
  await ready(page);
}
async function build(page, route, amount="2000") {
  await page.locator("#toolCalc").click();
  await page.locator("#calcTarget").fill(target);await page.locator("#calcAmount").fill(amount);await page.locator("#calcUnit").selectOption("L");
  await page.locator("#calcBuild").click();await page.locator(`select[data-route-good="${target}"]`).first().selectOption(route);
}
async function exportJson(page) {
  await page.locator('[data-calc-tab="code"]').click();await page.locator('[data-planner-code="json"]').click();
  return page.locator("#calcCodeOut").inputValue();
}
test("the real 2.9 dataset switches with its own atlas and calculator state, preserving 2.8 plans",async({page})=>{
  const errors=[];page.on("pageerror",e=>errors.push(e.message));
  await page.goto("./");await ready(page);await build(page,route28);await page.locator("#gtnhCalcClose").click();
  await switchTo(page,"2.9.0");
  await expect(page.locator("#toolDb")).toContainText("2.9.0");
  expect(await page.evaluate(()=>({dataset:window.GTNH_CATALOG.dataset.id,format:window.GTNH_CATALOG.repository.dataVersion,items:window.GTNH_CATALOG.repository.items.length,recipes:window.GTNH_CATALOG.repository.recipes.length}))).toEqual({dataset:"gtnh-2.9.0",format:7,items:50811,recipes:221760});
  expect(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue("--atlas-image"))).toContain("data/gtnh-2.9.0/atlas.webp");
  await page.locator("#toolCalc").click();expect(await page.locator("#calcTarget").inputValue()).toBe("");await page.locator("#gtnhCalcClose").click();
  await build(page,route29,"3000");expect(await page.evaluate(()=>window.GTNH_CALC.getPlan().knownEnergy)).toBe(57600);
  const json=await exportJson(page);expect(JSON.parse(json).dataset.id).toBe("gtnh-2.9.0");
  await page.locator('[data-planner-code="yaml"]').click();await expect(page.locator("#calcCodeOut")).toHaveValue(/gtnh-2.9.0/);
  await page.locator("#gtnhCalcClose").click();await switchTo(page,"2.8.0");
  await page.locator("#toolCalc").click();await expect(page.locator("#calcAmount")).toHaveValue("2000");
  expect(await page.evaluate(()=>window.GTNH_CALC.getState().routeChoices["f:gregtech:liquid_epichlorhydrin"])).toBe(route28);
  await page.locator('[data-calc-tab="code"]').click();
  await page.locator("#plannerImport").setInputFiles({name:"2.9-plan.json",mimeType:"application/json",buffer:Buffer.from(json)});
  await expect(page.locator("#plannerStatus")).toContainText("different recipe dataset");expect(errors).toEqual([]);
});
test("2.9 recipe permalinks render real recipes and route tools without loading the 2.8 binary",async({page})=>{
  const downloaded=[];page.on("request",request=>{if(request.url().endsWith("data.bin"))downloaded.push(request.url());});
  await page.goto("./?dataset=gtnh-2.9.0&item=f%3Agregtech%3Aliquid_epichlorhydrin");await ready(page);
  await expect(page.locator("#status")).toContainText("Epichlorohydrin");
  await expect(page.locator("#itemPermalink")).toHaveAttribute("href",/dataset=gtnh-2.9.0/);
  expect(downloaded).toHaveLength(1);expect(downloaded[0]).toContain("/data/gtnh-2.9.0/data.bin");
  await page.locator("#planCurrentItem").click();
  expect(await page.evaluate(()=>window.GTNH_CALC.getState().target)).toBe(target);
});
