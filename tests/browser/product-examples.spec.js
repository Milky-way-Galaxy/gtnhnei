import { test, expect } from "@playwright/test";
test("an empty calculator product suggests recent searches without selecting one or replacing user input", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("gtnhnei_help_seen", "1"));
  await page.clock.install(); await page.goto("./"); await expect(page.locator('#bootLoader[data-state="ready"]')).toBeAttached();
  await page.evaluate(async () => {
    const { rememberSearch } = await import(window.GTNH_MODULE_URL("./search-examples.js"));
    rememberSearch(window.GTNH_CATALOG.dataset, "Iron Ingot"); rememberSearch(window.GTNH_CATALOG.dataset, "Chloroform");
  });
  await page.locator("#toolCalc").click(); await page.locator("#calculatorChooseGood").focus();
  const product = page.locator("#calcTarget"), first = await product.getAttribute("placeholder");
  await page.clock.runFor(1100); expect(await product.getAttribute("placeholder")).not.toBe(first);
  await expect(product).toHaveValue(""); expect(await page.evaluate(() => window.GTNH_CALC.getState().target)).toBe("");
  await product.fill("i:minecraft:iron_ingot:0"); await page.clock.runFor(2200); await expect(product).toHaveValue("i:minecraft:iron_ingot:0");
  await page.locator("#calcBuild").click(); const plan = await page.evaluate(() => JSON.stringify(window.GTNH_CALC.getPlan()));
  await page.clock.runFor(2200); expect(await page.evaluate(() => JSON.stringify(window.GTNH_CALC.getPlan()))).toBe(plan);
  await page.locator("#gtnhCalcClose").click(); await page.locator("#toolCalc").click();
  await page.locator('[data-calc-tab="planner"]').click(); await expect(product).toHaveValue("i:minecraft:iron_ingot:0");
});
