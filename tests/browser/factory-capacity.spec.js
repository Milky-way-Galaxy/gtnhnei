import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
const target="f:gregtech:liquid_epichlorhydrin", recipe="r~7CR1mklsMhyejhfODug_QQ==";
test.beforeEach(async({page})=>{await page.addInitScript(()=>localStorage.setItem("gtnhnei_help_seen","1"));});
async function build(page, depth="1") {
  await page.goto("./"); await expect(page.locator('#bootLoader[data-state="ready"]')).toBeAttached();
  await page.locator("#toolCalc").click(); await page.locator("#calcTarget").fill(target);
  await page.locator("#calcUnit").selectOption("L"); await page.locator("#calcAmount").fill("3000");
  await page.locator("#calcRateMode").selectOption("per_minute"); await page.locator("#calcDepth").selectOption(depth);
  await page.locator("#calcBuild").click();
}
test("real reactor bottleneck controls update capacity, power and stock on desktop and mobile",async({page},testInfo)=>{
  const errors=[]; page.on("pageerror",error=>errors.push(error.message));
  await build(page); await page.locator(`select[data-route-good="${target}"]`).selectOption(recipe);
  const analysis=page.locator(".plannerCapacity"), input=page.locator(`[data-installed-machines="${recipe}"]`);
  await expect(analysis).toContainText("125% of requested output"); await expect(analysis).toContainText("62.5 L/s");
  await input.fill("1"); await input.blur();
  await expect(analysis).toContainText("62.5% of requested output"); await expect(analysis).toContainText("31.25 L/s");
  await expect(analysis).toContainText("160%"); await expect(analysis).toContainText("Over capacity");
  let plan=await page.evaluate(()=>window.GTNH_CALC.getPlan());
  expect(plan.knownInstalledEut).toBe(30); expect(plan.knownAverageEut).toBe(48); expect(plan.reusable[0].amount).toBe(1);
  await page.screenshot({path:testInfo.outputPath("factory-bottleneck.png")});
  await input.fill("0"); await input.blur(); await expect(analysis).toContainText("0% of requested output");
  await expect(analysis).toContainText("Stopped");
  plan=await page.evaluate(()=>window.GTNH_CALC.getPlan()); expect(plan.knownInstalledEut).toBe(0); expect(plan.reusable).toEqual([]);
  await page.locator(`[data-add-machine="${recipe}"]`).click(); await expect(input).toHaveValue("1");
  await input.fill("-1"); await input.blur(); await expect(input).toHaveValue("1");
  await expect(page.locator("#plannerStatus")).toContainText("Previous count retained");
  await page.locator(`[data-default-machines="${recipe}"]`).click(); await expect(input).toHaveValue("");
  await expect(analysis).toContainText("125% of requested output");
  expect(await page.locator("#gtnhCalcOverlay").evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
  expect(errors).toEqual([]);
});
test("recipe machine counts survive reload, portable plans and a useful machines CSV",async({page})=>{
  await build(page); await page.locator(`select[data-route-good="${target}"]`).selectOption(recipe);
  const input=page.locator(`[data-installed-machines="${recipe}"]`);
  await input.fill("3"); await input.blur(); await expect(page.locator(".plannerCapacity")).toContainText("187.5% of requested output");
  await page.locator('[data-calc-tab="code"]').click(); await page.locator('[data-planner-code="json"]').click();
  const json=await page.locator("#calcCodeOut").inputValue(); expect(JSON.parse(json).settings.machineConfigs[recipe].installedMachines).toBe(3);
  const pending=page.waitForEvent("download"); await page.locator("#plannerDownloadMachines").click();
  const download=await pending; expect(download.suggestedFilename()).toBe("gtnh-atlas-machines.csv");
  const csv=await readFile(await download.path(),"utf8"); expect(csv).toContain('"Required machines","Installed machines"'); expect(csv).toContain(`"${recipe}"`); expect(csv).toContain('"2","3","recipe"');
  await page.reload(); await expect(page.locator('#bootLoader[data-state="ready"]')).toBeAttached();
  await page.locator("#toolCalc").click(); await page.locator("#calcBuild").click();
  await expect(input).toHaveValue("3"); expect(await page.evaluate(()=>window.GTNH_CALC.getPlan().knownInstalledEut)).toBe(90);
  await page.locator('[data-calc-tab="code"]').click(); await page.locator("#plannerImport").setInputFiles({name:"factory.json",mimeType:"application/json",buffer:Buffer.from(json)});
  expect(await page.evaluate(()=>window.GTNH_CALC.getPlan().capacityAnalysis.rateFactor)).toBe(1.875);
});
test("unresolved routes and unknown timing never become an unlimited or guaranteed capacity claim",async({page})=>{
  await build(page,"3"); await expect(page.locator(".plannerCapacity")).toContainText("Known-stage capacity ceiling: unknown");
  await expect(page.locator(".plannerCapacity")).toContainText("Partial analysis");
  await page.locator(`select[data-route-good="${target}"]`).selectOption(recipe);
  await expect(page.locator(".plannerCapacity")).toContainText("Partial analysis");
  expect(await page.evaluate(()=>window.GTNH_CALC.getPlan().capacityAnalysis.hasUnresolvedRoutes)).toBe(true);
});
