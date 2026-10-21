import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
const target = "f:gregtech:liquid_epichlorhydrin", route = "r~7CR1mklsMhyejhfODug_QQ==";
async function ready(page, suffix = "") { await page.goto(`./${suffix}`); await expect(page.locator('#bootLoader[data-state="ready"]')).toBeAttached(); await page.locator("#toolCalc").click(); }
test("missing production entries export exact versioned coverage details without posting anything", async ({ page }) => {
  await ready(page);
  const id = await page.evaluate(() => { const good = window.GTNH_CATALOG.goods.find(g => g.id.startsWith("i:") && g.production.length === 0); window.GTNH_CALC.planItem(good.id); return good.id; });
  await page.locator(".plannerDiagnostics > details > summary").last().click();
  const pending = page.waitForEvent("download"); await page.locator(`[data-report-good="${id}"]`).click();
  const file = await pending, report = JSON.parse(await readFile(await file.path(), "utf8"));
  expect(report.dataset.id).toBe("gtnh-2.8.0"); expect(report.dataset.sha256).toHaveLength(64);
  expect(report.good.id).toBe(id); expect(report.productionEntries).toBe(0); expect(report.note).toContain("does not prove");
});
test("storage failure keeps calculated results visible and explains how to preserve the plan", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, "localStorage", { get() { throw new DOMException("Storage disabled", "SecurityError"); } }));
  await ready(page); await page.locator("#calcTarget").fill(target); await page.locator("#calcAmount").fill("2000"); await page.locator("#calcBuild").click();
  await page.locator(`select[data-route-good="${target}"]`).first().selectOption(route);
  await expect(page.locator("#plannerStatus")).toContainText("Export JSON");
  await expect(page.locator("#calcTree")).toContainText("38,400 EU"); expect(await page.evaluate(() => window.GTNH_CALC.getPlan().knownEnergy)).toBe(38400);
});
test("one calculator preserves factory settings, numerical results and exports when changing modes", async ({ page }, info) => {
  await ready(page); await expect(page.locator("#toolMatCalc")).toHaveCount(0);
  await expect(page.locator("#calculatorModeBasic")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#plannerFactory")).not.toBeVisible();
  await page.locator("#calcTarget").fill(target); await page.locator("#calcUnit").selectOption("L");
  await page.locator("#calcAmount").fill("3000"); await page.locator("#calcRateMode").selectOption("per_minute");
  await page.locator("#calcBuild").click(); await page.locator(`select[data-route-good="${target}"]`).first().selectOption(route);
  await page.locator("#calculatorModeFactory").click(); await page.locator('[data-calc-tab="planner"]').click();
  await page.locator("#plannerFactory > summary").click(); await page.locator("#plannerFactoryGood").fill("f:GalacticraftMars:hydrogen"); await page.locator("#plannerAddTarget").click();
  const before = await page.evaluate(() => { const state = window.GTNH_CALC.getState(); delete state.uiMode; return { state, power: window.GTNH_CALC.getPlan().knownAverageEut }; });
  await page.locator("#calculatorModeBasic").click(); await expect(page.locator("#calculatorActiveSettings")).toContainText("1 additional output");
  const after = await page.evaluate(() => { const state = window.GTNH_CALC.getState(); delete state.uiMode; return { state, power: window.GTNH_CALC.getPlan().knownAverageEut }; });
  expect(after).toEqual(before); expect(after.power).toBe(48);
  await page.locator('[data-calc-tab="code"]').click(); await page.locator('[data-planner-code="json"]').click();
  const json = JSON.parse(await page.locator("#calcCodeOut").inputValue()); expect(json.settings.additionalTargets).toHaveLength(1); expect(json.settings.uiMode).toBe("basic");
  await page.screenshot({ path: info.outputPath("unified-calculator.png") });
});
test("a legacy-only draft opens with its exact route, units and fractional semantics", async ({ page }) => {
  const original = JSON.stringify({ target, amount: 2, routeIndex: 0, amountMode: "runs", waterFree: false, cellsReusable: false });
  await page.addInitScript(text => { localStorage.setItem("gtnh_material_calc_state_v4", text); localStorage.setItem("gtnh_material_calc_v4_migrated", "1"); }, original);
  await ready(page); await expect(page.locator("#calcUnit")).toHaveValue("batches");
  await expect(page.locator("#calcRounding")).toHaveValue("fractional");
  await page.locator("#calcBuild").click();
  expect(await page.evaluate(() => window.GTNH_CALC.getPlan().knownEnergy)).toBe(38400);
  expect(await page.evaluate(id => window.GTNH_CALC.getState().routeChoices[id], target)).toBe(route);
  expect(await page.evaluate(() => localStorage.getItem("gtnh_material_calc_state_v4"))).toBe(original);
});
test("both old drafts survive import and workspace restoration, including reload", async ({ page }) => {
  await page.addInitScript(({ target }) => {
    if (localStorage.getItem("draft-test-seeded")) return;
    localStorage.setItem("draft-test-seeded", "1");
    localStorage.setItem("gtnh_atlas_planner_v1_gtnh-2.8.0", JSON.stringify({ target: "i:minecraft:iron_ingot:0", amount: 3, settings: { waterFree: false } }));
    localStorage.setItem("gtnh_material_calc_state_v4", JSON.stringify({ target, amount: 2, amountMode: "runs" }));
    localStorage.setItem("gtnh_material_calc_v4_migrated", "1");
  }, { target });
  await ready(page); await expect(page.locator("#calcAmount")).toHaveValue("3");
  await expect(page.locator("#calculatorModeFactory")).toHaveAttribute("aria-pressed", "true");
  await page.locator("#calculatorMigration > summary").click(); await page.locator("#calculatorImportLegacy").click();
  await expect(page.locator("#calcTarget")).toHaveValue(target); expect(await page.evaluate(() => window.GTNH_CALC.getPlan().knownEnergy)).toBe(38400);
  await page.reload(); await expect(page.locator('#bootLoader[data-state="ready"]')).toBeAttached(); await page.locator("#toolCalc").click();
  await page.locator("#calculatorMigration > summary").click(); await page.locator("#calculatorRestoreDraft").click();
  await expect(page.locator("#calcTarget")).toHaveValue("i:minecraft:iron_ingot:0"); await expect(page.locator("#calcAmount")).toHaveValue("3");
  expect(await page.evaluate(() => window.GTNH_CALC.getState().settings.waterFree)).toBe(false);
});
test("a 2.8 legacy draft never supplies recipe choices to 2.9", async ({ page }) => {
  await page.addInitScript(({ target }) => localStorage.setItem("gtnh_material_calc_state_v4", JSON.stringify({ target, amount: 9 })), { target });
  await ready(page, "?dataset=gtnh-2.9.0"); await expect(page.locator("#calcTarget")).toHaveValue("");
  expect(await page.evaluate(() => window.GTNH_CALC.getState().routeChoices)).toEqual({});
});
