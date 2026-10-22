import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { localStorage.setItem("gtnhnei_help_seen", "1"); localStorage.setItem("gtnh_atlas_intro_hidden_v1", "1"); });
  await page.clock.install();
  await page.goto("./"); await expect(page.locator('#bootLoader[data-state="ready"]')).toBeAttached();
});
async function seedExamples(page) {
  return page.evaluate(async () => {
    const catalog = window.GTNH_CATALOG, iron = catalog.resolve("i:minecraft:iron_ingot:0"), fluid = catalog.goods.find(g => g.name === "Chloroform" && g.id.startsWith("f:"));
    if (!iron || !fluid) throw new Error("The verified dataset is missing the real example anchors");
    const { rememberSearch } = await import(window.GTNH_MODULE_URL("./search-examples.js"));
    rememberSearch(catalog.dataset, iron.name); rememberSearch(catalog.dataset, fluid.name);
    return { iron: iron.id, fluid: fluid.id, names: [iron.name, fluid.name] };
  });
}
test("recent examples rotate each second without changing a real plan, and pause for input and user preferences", async ({ page }) => {
  const { iron, names } = await seedExamples(page), field = page.locator("#search");
  await page.evaluate(iron => { window.GTNH_CALC.planItem(iron); window.GTNH_CALC.close(); }, iron);
  const before = await page.evaluate(() => ({ state: window.GTNH_CALC.getState(), plan: window.GTNH_CALC.getPlan() }));
  const first = await field.getAttribute("placeholder"); await page.clock.runFor(1100);
  const second = await field.getAttribute("placeholder"); expect(second).not.toBe(first); expect(names.map(n => `Search: ${n}`)).toContain(second);
  await field.focus(); const frozen = await field.getAttribute("placeholder"); await page.clock.runFor(2200); await expect(field).toHaveAttribute("placeholder", frozen);
  await field.fill("iron"); await page.clock.runFor(2200); await expect(field).toHaveValue("iron");
  expect(await page.evaluate(() => ({ state: window.GTNH_CALC.getState(), plan: window.GTNH_CALC.getPlan() }))).toEqual(before);
  await page.locator("#clear").click(); await page.locator("#toolMore").click(); await page.locator("#toolSearchExamples").click();
  await page.locator("#toolMore").click(); await expect(page.locator("#toolSearchExamples")).toHaveAttribute("aria-checked", "false"); await page.keyboard.press("Escape");
  const stopped = await field.getAttribute("placeholder"); await page.clock.runFor(2200); await expect(field).toHaveAttribute("placeholder", stopped);
  await page.reload(); await expect(page.locator('#bootLoader[data-state="ready"]')).toBeAttached();
  await page.locator("#toolMore").click(); await expect(page.locator("#toolSearchExamples")).toHaveAttribute("aria-checked", "false");
});
test("successful searches provide examples after reload and stay with their exact dataset", async ({ page }) => {
  const field = page.locator("#search"); await field.fill("Chloroform"); await page.clock.runFor(1600);
  const history = () => page.evaluate(async () => (await import(window.GTNH_MODULE_URL("./search-examples.js"))).readSearchHistory(window.GTNH_CATALOG.dataset));
  expect(await history()).toContain("Chloroform");
  await field.fill("absent-unique-example-zzzz"); await page.clock.runFor(1600); expect(await history()).not.toContain("absent-unique-example-zzzz");
  await page.reload(); await expect(page.locator('#bootLoader[data-state="ready"]')).toBeAttached(); expect(await history()).toContain("Chloroform");
  await page.goto("./?dataset=gtnh-2.9.0"); await expect(page.locator('#bootLoader[data-state="ready"]')).toBeAttached(); expect(await history()).toEqual([]);
  await page.goto("./?dataset=gtnh-2.8.0"); await expect(page.locator('#bootLoader[data-state="ready"]')).toBeAttached(); expect(await history()).toContain("Chloroform");
  await page.locator("#toolFav").click(); await page.locator('[data-library-tab="recent"]').click(); await page.locator("#libraryClearRecent").click(); expect(await history()).toEqual([]);
});
test("recent picker shortcuts select the exact fluid and reduced motion keeps examples still", async ({ page }, info) => {
  const { iron, fluid } = await seedExamples(page);
  await page.evaluate(async ({ iron, fluid }) => {
    const { ItemLibrary } = await import(window.GTNH_MODULE_URL("./item-library.js")), library = new ItemLibrary(window.GTNH_CATALOG, localStorage);
    library.visit(iron); library.visit(fluid);
  }, { iron, fluid });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const frozen = await page.locator("#search").getAttribute("placeholder"); await page.clock.runFor(2200); await expect(page.locator("#search")).toHaveAttribute("placeholder", frozen);
  await page.locator("#toolCalc").click(); await page.locator("#calculatorChooseGood").click();
  await expect(page.locator("#pickerQuickRecent button")).toHaveCount(2);
  for (const width of [320, 393, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.locator("#itemPickerDialog").evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  }
  await page.setViewportSize({ width: 393, height: 844 }); await page.screenshot({ path: info.outputPath("recent-item-shortcuts.png") });
  await page.locator(`[data-recent-good="${fluid}"]`).click(); await expect(page.locator("#calcTarget")).toHaveValue(fluid); await expect(page.locator("#calcUnit")).toHaveValue("L");
});
