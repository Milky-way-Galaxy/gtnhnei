import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("gtnhnei_help_seen","1"));
});
async function ready(page) { await page.goto("./"); await expect(page.locator('#bootLoader[data-state="ready"]')).toBeAttached(); }
test("reported pine plank search renders all four matching items without a grid error", async ({ page }) => {
  const errors = []; page.on("pageerror", error => errors.push(error.message));
  await ready(page); await page.locator("#search").fill("pine plank");
  await expect(page.locator("#status")).toContainText("4 result(s)");
  await expect(page.locator("#grid .slot")).toHaveCount(4);
  expect(errors).toEqual([]);
});
test("type/mod/production filters and name sorting remain valid while loading more", async ({ page }) => {
  await ready(page);
  await page.locator("#searchFilters summary").click();
  await page.selectOption("#filterType","fluid");
  await page.selectOption("#filterSort","name");
  await page.check("#filterProduction");
  const check = () => page.evaluate(() => {
    const ids = [...document.querySelectorAll("#grid .slot")].map(slot => slot.dataset.goodsId);
    const goods = ids.map(id => window.GTNH_CATALOG.resolve(id));
    return goods.length > 0 && goods.every(g => g.id.startsWith("f:") && g.production.length > 0) && goods.every((g,index) => index===0 || new Intl.Collator("en",{numeric:true,sensitivity:"base"}).compare(goods[index-1].name,g.name)<=0);
  });
  expect(await check()).toBe(true);
  await page.locator("#grid").evaluate(grid => { grid.scrollTop = grid.scrollHeight; });
  expect(await check()).toBe(true);
  await page.locator("#filterReset").click();
  await expect(page.locator("#filterType")).toHaveValue("all");
});
test("recipe permalinks preserve dataset, exact ID and usage mode and can open the planner", async ({ page }) => {
  await page.goto("./?dataset=gtnh-2.8.0&item=i%3Aminecraft%3Airon_ingot%3A0&view=usage");
  await expect(page.locator("#status")).toContainText("Usage: Iron Ingot");
  await expect(page.locator("#itemPermalink")).toHaveAttribute("href",/dataset=gtnh-2.8.0.*item=i%3Aminecraft%3Airon_ingot%3A0.*view=usage/);
  await page.locator("#planCurrentItem").click();
  expect(await page.evaluate(() => window.GTNH_CALC.getState().target)).toBe("i:minecraft:iron_ingot:0");
  await expect(page.locator("#gtnhCalcOverlay")).toBeVisible();
});
test("grid supports arrow-key navigation and a single roving Tab stop", async ({ page }) => {
  await ready(page);
  const first = page.locator("#grid .slot").first(); await first.focus();
  expect(await first.evaluate(slot => {
    const event = new KeyboardEvent("keydown", { key: "f", ctrlKey: true, bubbles: true, cancelable: true });
    slot.dispatchEvent(event); return event.defaultPrevented;
  })).toBe(false);
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("#grid .slot").nth(1)).toBeFocused();
  await expect(page.locator('#grid .slot[tabindex="0"]')).toHaveCount(1);
  await page.keyboard.press("Home"); await expect(first).toBeFocused();
});
test("exact IDs resolve one good and recipe chance outputs show their probability", async ({ page }) => {
  await ready(page);
  await page.locator("#search").fill("i:minecraft:iron_ingot:0");
  await expect(page.locator("#grid .slot")).toHaveCount(1);
  await expect(page.locator("#grid .slot")).toHaveAttribute("data-goods-id","i:minecraft:iron_ingot:0");
  await page.locator("#grid .slot").click();
  await expect(page.locator("#recipePage .neiProbability").filter({hasText:"25%"}).first()).toBeVisible();
});
