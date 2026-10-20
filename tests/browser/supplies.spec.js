import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
const target = "f:gregtech:liquid_epichlorhydrin";
for (const [version, route] of [["2.8.0", "r~7CR1mklsMhyejhfODug_QQ=="], ["2.9.0", "r~RgUYVgBcPJmt4u3DO2ZYIg=="]]) {
  test(`real ${version} supplies integrate two hours, retain checks and scale to installed capacity`, async ({ page }, info) => {
    test.setTimeout(90000);
    await page.goto(`./?dataset=gtnh-${version}`); await expect(page.locator('#bootLoader[data-state="ready"]')).toBeAttached();
    await page.locator("#toolCalc").click();
    await page.locator("#calcTarget").fill(target); await page.locator("#calcUnit").selectOption("L"); await page.locator("#calcRateMode").selectOption("per_minute"); await page.locator("#calcAmount").fill("3000");
    await page.locator("#calcBuild").click(); await page.locator(`select[data-route-good="${target}"]`).first().selectOption(route);
    const original = await page.evaluate(() => { const plan = window.GTNH_CALC.getPlan(); return { materials: plan.materials, energy: plan.knownAverageEut, reusable: plan.reusable }; });
    expect(original.energy).toBe(48);
    const chlorine = original.materials.find(row => row.name === "Chlorine");
    await page.locator("#plannerSupplies").click(); await page.locator("#supplyHours").fill("2"); await page.locator("#supplyBasis").focus();
    const row = page.locator("#supplyDialog .supplyRow").filter({ hasText: chlorine.id });
    await expect(row).toContainText("720,000 L"); await expect(row).toContainText("720 buckets");
    await expect(page.locator("#supplyResults")).toContainText("6,912,000 EU");
    await row.locator("input").check();
    expect(await page.evaluate(key => window.GTNH_CALC.getState().checklist[key], `input:${chlorine.id}`)).toBe(720000);
    expect(await page.evaluate(() => window.GTNH_CALC.getPlan().knownAverageEut)).toBe(48);
    await page.screenshot({ path: info.outputPath(`supplies-${version}.png`) });
    await page.keyboard.press("Escape");
    await page.locator('[data-calc-tab="code"]').click(); await page.locator('[data-planner-code="json"]').click();
    const json = JSON.parse(await page.locator("#calcCodeOut").inputValue());
    expect(json.settings.operatingSeconds).toBe(7200); expect(json.settings.checklist[`input:${chlorine.id}`]).toBe(720000);
    await page.locator('[data-calc-tab="tree"]').click();
    const count = page.locator(`[data-installed-machines="${route}"]`).first(); await count.fill("1"); await count.press("Tab");
    await page.locator("#plannerSupplies").click(); await page.locator("#supplyBasis").selectOption("installed");
    await expect(row).toContainText("450,000 L"); await expect(row.locator("input")).not.toBeChecked();
    await expect(page.locator("#supplyResults")).toContainText("4,320,000 EU");
    const downloadEvent = page.waitForEvent("download"); await page.locator("#supplyCsv").click(); const file = await downloadEvent;
    const csv = await readFile(await file.path(), "utf8");
    expect(csv).toContain('"Duration (seconds)"'); expect(csv).toContain('"7200","0.625"'); expect(csv).toContain(chlorine.id);
    await page.evaluate(() => { window.print = () => { window.printSnapshot = { onlySupplies: document.body.classList.contains("atlasPrintingSupplies"), hiddenApp: getComputedStyle(document.querySelector(".app")).display, rootOverflow: getComputedStyle(document.documentElement).overflow }; }; });
    await page.emulateMedia({ media: "print" }); await page.locator("#supplyPrint").click();
    expect(await page.evaluate(() => window.printSnapshot)).toEqual({ onlySupplies: true, hiddenApp: "none", rootOverflow: "visible" });
    await page.emulateMedia({ media: "screen" });
  });
}
