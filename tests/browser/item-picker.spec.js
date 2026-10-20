import { test, expect } from "@playwright/test";
const epi = "f:gregtech:liquid_epichlorhydrin", iron = "i:minecraft:iron_ingot:0";
async function ready(page, suffix = "") { await page.goto(`./${suffix}`); await expect(page.locator('#bootLoader[data-state="ready"]')).toBeAttached(); await page.locator("#toolCalc").click(); }
test("NEI picker browses icons without typing and selects the exact fluid with litres", async ({ page }, info) => {
  const errors = []; page.on("pageerror", error => errors.push(error.message));
  await ready(page); await page.locator("#calculatorChooseGood").click();
  await expect(page.locator("#pickerGrid .pickerGood")).toHaveCount(60);
  await expect(page.locator("#pickerNext")).toBeEnabled();
  await page.locator("#pickerType").selectOption("fluid"); await page.locator("#pickerSearch").fill("epichl");
  const choice = page.locator(`[data-pick-good="${epi}"]`); await expect(choice).toBeVisible();
  expect(await choice.locator(".pickerIcon").evaluate(icon => getComputedStyle(icon).backgroundImage)).toContain("atlas");
  await page.screenshot({ path: info.outputPath("nei-product-picker.png") });
  await choice.click(); await expect(page.locator("#itemPickerDialog")).not.toBeVisible();
  await expect(page.locator("#calcTarget")).toHaveValue(epi); await expect(page.locator("#calcUnit")).toHaveValue("L");
  await expect(page.locator("#calculatorSelectedGood")).toContainText("Epichlorohydrin");
  await expect(page.locator("#calculatorSelectedGood")).toContainText("1000 L = 1 bucket");
  await page.locator("#calcBuild").click(); await page.locator(`select[data-route-good="${epi}"]`).first().selectOption("r~7CR1mklsMhyejhfODug_QQ==");
  expect(await page.evaluate(() => window.GTNH_CALC.getPlan().target.id)).toBe(epi);
  expect(errors).toEqual([]);
});
test("favorites and recents are usable as product shortcuts without remembering a name", async ({ page }) => {
  await page.goto(`./?item=${encodeURIComponent(iron)}`); await expect(page.locator('#bootLoader[data-state="ready"]')).toBeAttached(); await page.locator("#favoriteCurrentItem").click();
  await page.locator("#toolCalc").click(); await page.locator("#calculatorChooseGood").click();
  await page.locator('[data-picker-source="favorites"]').click(); await page.locator(`[data-pick-good="${iron}"]`).click();
  await expect(page.locator("#calcUnit")).toHaveValue("items");
  await page.locator("#calculatorChooseGood").click(); await page.locator('[data-picker-source="recent"]').click();
  await expect(page.locator(`[data-pick-good="${iron}"]`)).toBeVisible(); await page.keyboard.press("Escape");
  await expect(page.locator("#calculatorChooseGood")).toBeFocused();
  await expect(page.locator("#gtnhCalcOverlay")).toBeVisible(); await expect(page.locator("#calcTarget")).toHaveValue(iron);
});
test("the same picker fills additional outputs and inventory while keeping their exact units", async ({ page }) => {
  await ready(page); await page.locator("#calculatorModeFactory").click(); await page.locator("#calcTarget").fill(iron);
  await page.locator("#plannerFactory > summary").click(); await page.locator('[data-pick-field="plannerFactoryGood"]').click();
  await page.locator("#pickerSearch").fill("epichl"); await page.locator(`[data-pick-good="${epi}"]`).click(); await page.locator("#plannerAddTarget").click();
  await page.locator("#plannerInventory > summary").click(); await page.locator('[data-pick-field="plannerStockGood"]').click();
  await page.locator("#pickerSearch").fill(iron); await page.locator(`[data-pick-good="${iron}"]`).click(); await page.locator("#plannerStockAmount").fill("64"); await page.locator("#plannerAddStock").click();
  const state = await page.evaluate(() => window.GTNH_CALC.getState());
  expect(state.additionalTargets[0]).toMatchObject({ target: epi, unit: "L" }); expect(state.inventory[iron]).toBe(64);
});
test("picker browsing works when saved-item storage is unavailable and in the 2.9 dataset", async ({ page }) => {
  await page.addInitScript(() => { const get = Storage.prototype.getItem; Storage.prototype.getItem = function(key) { if (key.startsWith("gtnh_atlas_item_library") || key.startsWith("gtnhnei_favorites")) throw new Error("Storage blocked"); return get.call(this, key); }; });
  await ready(page, "?dataset=gtnh-2.9.0"); await page.locator("#calculatorChooseGood").click();
  await expect(page.locator("#pickerStatus")).toContainText("Saved items are unavailable"); await expect(page.locator("#pickerStatus")).toContainText("2.9.0");
  await page.locator("#pickerSearch").fill("epichl"); await page.locator(`[data-pick-good="${epi}"]`).click();
  await expect(page.locator("#calcUnit")).toHaveValue("L");
});
