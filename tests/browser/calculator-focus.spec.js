import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("gtnhnei_help_seen", "1"));
  await page.goto("./");
  await expect(page.locator('#bootLoader[data-state="ready"]')).toBeAttached();
});
async function preferred(page) {
  const touch = await page.evaluate(() => matchMedia("(pointer: coarse)").matches);
  return page.locator(touch ? "#calculatorChooseGood" : "#calcTarget");
}
test("opening the calculator focuses NEI on touch screens and retains desktop typing", async ({ page }) => {
  await page.locator("#toolCalc").click();
  await expect(await preferred(page)).toBeFocused();
  await expect(page.locator("#calcTarget")).toHaveValue("");
  await page.locator("#gtnhCalcClose").click();
  await expect(page.locator("#toolCalc")).toBeFocused();
});
test("reopening an export view never leaves focus in a hidden settings pane", async ({ page }) => {
  await page.locator("#toolCalc").click();
  await page.locator('[data-calc-tab="code"]').click();
  await page.locator("#gtnhCalcClose").click();
  await page.locator("#toolCalc").click();
  await expect(page.locator("#calcCodeOut")).toBeVisible();
  await expect(page.viewportSize().width <= 980 ? page.locator("#gtnhCalcClose") : await preferred(page)).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.locator("#gtnhCalcOverlay")).toBeHidden();
  await expect(page.locator("#toolCalc")).toBeFocused();
});
