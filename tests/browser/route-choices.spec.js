import { test, expect } from "@playwright/test";
const target = "f:gregtech:liquid_epichlorhydrin", route = "r~7CR1mklsMhyejhfODug_QQ==";
test("route cards expose real base metrics, filter safely and apply an exact production route", async ({ page }, info) => {
  await page.goto("./"); await expect(page.locator('#bootLoader[data-state="ready"]')).toBeAttached();
  await page.locator("#toolCalc").click(); await page.locator("#calcTarget").fill(target); await page.locator("#calcAmount").fill("2000"); await page.locator("#calcUnit").selectOption("L"); await page.locator("#calcBuild").click();
  const compare = page.locator(`[data-compare-good="${target}"]`).first(); await compare.click();
  const dialog = page.locator("#routeChoiceDialog"), card = dialog.locator(`[data-route-recipe="${route}"]`);
  await dialog.locator("#routeTextFilter").fill(route); await expect(card).toBeVisible();
  await expect(card.locator(".routeMetrics")).toContainText("19.2"); await expect(card).toContainText("1,000 L");
  await card.locator("summary").click(); await expect(card).toContainText("Reusable startup stock"); await expect(card).toContainText("Chlorine");
  await page.screenshot({ path: info.outputPath("route-comparison.png") });
  await card.locator("[data-pick-route]").click();
  await expect(dialog).not.toBeVisible(); expect(await page.evaluate(() => window.GTNH_CALC.getState().routeChoices["f:gregtech:liquid_epichlorhydrin"])).toBe(route);
  expect(await page.evaluate(() => window.GTNH_CALC.getPlan().knownEnergy)).toBe(38400);
  await expect(compare).toBeFocused();
  await compare.click(); await dialog.locator("#routeTextFilter").fill(route); await dialog.locator("#routeMaximumVoltage").selectOption("8");
  await expect(dialog.locator("#routeChoicesStatus")).toContainText("0 of");
  await expect(dialog.locator("#routeChoiceRows")).toContainText("No routes match");
});
test("unavailable browser preferences do not block startup, grid controls or recipe lookup", async ({ page }) => {
  const errors = []; page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => Object.defineProperty(window, "localStorage", { get() { throw new DOMException("Storage disabled", "SecurityError"); } }));
  await page.goto("./"); await expect(page.locator('#bootLoader[data-state="ready"]')).toBeAttached();
  await page.locator('[data-grid-limit="1000"]').click(); await expect(page.locator("#status")).toContainText("1000");
  await page.locator("#search").fill("i:minecraft:iron_ingot:0"); await expect(page.locator("#grid .slot")).toHaveCount(1);
  await page.locator("#grid .slot").click(); await expect(page.locator("#status")).toContainText("Production: Iron Ingot");
  expect(errors).toEqual([]);
});
