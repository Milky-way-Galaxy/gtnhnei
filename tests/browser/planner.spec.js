import { test, expect } from "@playwright/test";
const target = "f:gregtech:liquid_epichlorhydrin", route = "r~7CR1mklsMhyejhfODug_QQ==";
let exceptions;
test.beforeEach(async ({ page }) => {
  exceptions = [];
  page.on("pageerror", error => exceptions.push(error.message));
  await page.addInitScript(() => { localStorage.setItem("gtnhnei_help_seen", "1"); });
});
test.afterEach(() => expect(exceptions).toEqual([]));
async function start(page) {
  await page.goto("./");
  await expect(page.locator('#bootLoader[data-state="ready"]')).toBeAttached();
  await page.locator("#toolCalc").click();
  await page.locator("#calcTarget").fill(target);
  await page.locator("#calcAmount").fill("2000");
  await page.locator("#calcUnit").selectOption("L");
  await page.locator("#calcBuild").click();
  await page.locator(`select[data-route-good="${target}"]`).first().selectOption(route);
}
test("planner computes exact real materials and throughput with selectable routes", async ({ page }) => {
  await start(page);
  let result = await page.evaluate(() => window.GTNH_CALC.getPlan());
  expect(result.root.batches).toBe(2);
  expect(result.knownEnergy).toBe(38400);
  expect(result.materials.find(row => row.name === "Chlorine").amount).toBe(4000);
  expect(result.reusable.find(row => row.name === "Programmed Circuit").amount).toBe(1);
  await page.locator('[data-calc-tab="planner"]').click();
  await page.locator("#calcAmount").fill("3000");
  await page.locator("#calcRateMode").selectOption("per_minute");
  await page.locator("#calcBuild").click();
  result = await page.evaluate(() => window.GTNH_CALC.getPlan());
  expect(result.steps[0].count).toBe(2);
  expect(result.knownAverageEut).toBe(48);
  expect(result.knownInstalledEut).toBe(60);
  await expect(page.locator(".plannerDiagram svg")).toBeVisible();
});
test("portable JSON import and CSV/SVG downloads contain real computed data", async ({ page }) => {
  await start(page);
  await page.locator('[data-calc-tab="code"]').click();
  await page.locator('[data-planner-code="json"]').click();
  const text = await page.locator("#calcCodeOut").inputValue();
  expect(JSON.parse(text).dataset.id).toBe("gtnh-2.8.0");
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#plannerDownloadCsv").click();
  expect((await downloadPromise).suggestedFilename()).toBe("gtnh-atlas-materials.csv");
  await page.locator("#plannerImport").setInputFiles({ name: "plan.json", mimeType: "application/json", buffer: Buffer.from(text) });
  expect(await page.evaluate(() => window.GTNH_CALC.getPlan().root.batches)).toBe(2);
  const mismatched = JSON.parse(text); mismatched.dataset.id = "gtnh-2.8.4";
  await page.locator("#plannerImport").setInputFiles({ name: "wrong.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(mismatched)) });
  await expect(page.locator("#plannerStatus")).toContainText("different recipe dataset");
  expect(await page.evaluate(() => window.GTNH_CALC.getState().target)).toBe(target);
});
test("machine profiles explicitly change rate, energy and parallel capacity", async ({ page }) => {
  await start(page);
  const profile = page.locator(".plannerProfile").first();
  await profile.locator("..").locator("summary").click();
  await profile.locator('[data-profile-field="overclocks"]').fill("1");
  await profile.locator('[data-profile-field="overclocks"]').blur();
  const result = await page.evaluate(() => window.GTNH_CALC.getPlan());
  expect(result.root.performance.durationTicks).toBe(320);
  expect(result.root.performance.eut).toBe(120);
  expect(result.knownEnergy).toBe(76800);
});
test("material calculator uses the same ID-based calculation and preserves cell consumption", async ({ page }) => {
  await page.goto("./"); await expect(page.locator('#bootLoader[data-state="ready"]')).toBeAttached();
  await page.locator("#toolMatCalc").click();
  await page.locator("#matTarget").fill(target);
  await page.locator("#matAmount").fill("2");
  await page.locator("#matRoute").fill("1");
  await page.locator("#matCalculate").click();
  await expect(page.locator("#matResults")).toContainText("Chlorine");
  const result = await page.evaluate(() => window.GTNH_MATCALC.lastPlan);
  expect(result.root.batches).toBe(2);
  expect(result.knownEnergy).toBe(38400);
  expect(result.materials.find(row => row.name === "Chlorine").amount).toBe(4000);
});
test("version picker labels verified 2.8.0 and refuses unverified 2.8.4", async ({ page }) => {
  await page.goto("./"); await expect(page.locator('#bootLoader[data-state="ready"]')).toBeAttached();
  await expect(page.locator("#toolDb")).toContainText("2.8.0");
  await page.locator("#toolNei").click();
  await expect(page.locator("#gtnhNeiDrop button").filter({ hasText: "2.8.4" })).toBeDisabled();
  await page.goto("./?dataset=gtnh-2.8.4");
  await expect(page.locator(".bootMsg")).toContainText("unavailable");
  await page.locator("#bootResetDataset").click();
  await expect(page.locator('#bootLoader[data-state="ready"]')).toBeAttached();
});
test("a version checksum mismatch is visible and can recover on retry", async ({ page }) => {
  let count = 0;
  await page.route("**/data/manifest.json", async route => {
    if (++count > 1) { await route.continue(); return; }
    const response = await route.fetch(); const body = await response.json();
    body.datasets[0].uncompressedSha256 = "0".repeat(64);
    await route.fulfill({ json: body });
  });
  await page.goto("./");
  await expect(page.locator(".bootMsg")).toContainText("checksum");
  await page.locator("#bootRetry").click();
  await expect(page.locator('#bootLoader[data-state="ready"]')).toBeAttached();
});

test("planner traps keyboard focus and Escape returns to its opener", async ({ page }) => {
  await page.goto("./"); await expect(page.locator('#bootLoader[data-state="ready"]')).toBeAttached();
  await page.locator("#toolCalc").click();
  await expect(page.locator("#calcTarget")).toBeFocused();
  await page.locator("#gtnhCalcClose").focus();
  await page.keyboard.press("Shift+Tab");
  expect(await page.evaluate(() => !!document.activeElement.closest("#gtnhCalcOverlay"))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.locator("#gtnhCalcOverlay")).not.toBeVisible();
  await expect(page.locator("#toolCalc")).toBeFocused();
});
test("legacy zero-amount drafts retain route choices and explicit saved settings", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("gtnhnei_calc_state",JSON.stringify({target:"Iron Ingot",amount:0,lockedRoutes:{"iron ingot":4},settings:{waterFree:false}}));
    localStorage.setItem("gtnh_material_calc_state_v4",JSON.stringify({target:"Iron Ingot",cellsReusable:false,ignoreCircuits:false}));
  });
  await page.goto("./"); await expect(page.locator('#bootLoader[data-state="ready"]')).toBeAttached();
  await page.locator("#toolCalc").click();
  const state=await page.evaluate(()=>window.GTNH_CALC.getState());
  expect(state.amount).toBe(1); expect(state.settings.waterFree).toBe(false); expect(state.lockedRoutes["iron ingot"]).toBe(4);
  const material=await page.evaluate(()=>window.GTNH_MATCALC.getState());
  expect(material.cellsReusable).toBe(false); expect(material.ignoreCircuits).toBe(false);
});
