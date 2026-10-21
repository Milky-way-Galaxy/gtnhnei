import { test, expect } from "@playwright/test";
const target = "f:gregtech:liquid_epichlorhydrin";
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("gtnhnei_help_seen", "1"));
});
async function ready(page, suffix = "") {
  await page.goto(`./${suffix}`);
  await expect(page.locator('#bootLoader[data-state="ready"]')).toBeAttached();
}
async function visibleBuild(page) {
  const box = await page.locator("#calcBuild").boundingBox();
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize().height);
}
test("calculator panels and build controls remain usable from 320px phones through desktop", async ({ page }, info) => {
  await ready(page); await page.locator("#toolCalc").click();
  for (const width of [320, 768, 980, 1024, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await page.locator('[data-calc-tab="planner"]').click();
    await expect(page.locator('[data-calc-panel="planner"]')).toBeVisible();
    await expect(page.locator('[data-calc-panel="code"]')).toBeHidden();
    await visibleBuild(page);
    await page.locator('[data-calc-tab="code"]').click();
    await expect(page.locator("#calcCodeOut")).toBeVisible();
    await expect(page.locator('[data-calc-panel="tree"]')).toBeHidden();
    await expect(page.locator('[data-calc-tab="code"]')).toHaveAttribute("aria-pressed", "true");
    await page.locator('[data-calc-tab="tree"]').click();
    await expect(page.locator('[data-calc-panel="tree"]')).toBeVisible();
    expect(await page.locator(".gtnhCalcWorkspace").evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    await visibleBuild(page);
    if (width === 320 || width === 1440) await page.screenshot({ path: info.outputPath(`calculator-${width}.png`) });
  }
  // Short landscape screens still retain a usable scroll area and both actions.
  await page.setViewportSize({ width: 740, height: 360 });
  await page.locator('[data-calc-tab="planner"]').click();
  await page.locator("#calcClear").scrollIntoViewIfNeeded(); await visibleBuild(page);
});
test("recipe cards adapt to screen width and irrelevant grid controls return with search", async ({ page }, info) => {
  await ready(page, `?item=${encodeURIComponent(target)}`);
  await expect(page.locator("#recipePage .recipe")).toHaveCount(13);
  await expect(page.locator("#atlasGridLimitPanel")).toBeHidden();
  const first = await page.locator("#recipePage .recipe").nth(0).boundingBox(), second = await page.locator("#recipePage .recipe").nth(1).boundingBox();
  if (page.viewportSize().width >= 1050) expect(second.x).toBeGreaterThan(first.x + first.width);
  else expect(Math.abs(second.x - first.x)).toBeLessThan(1);
  expect(await page.locator("#recipePage").evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  await page.screenshot({ path: info.outputPath("recipe-browser.png") });
  await page.locator("#search").fill("iron");
  await expect(page.locator("#grid .slot").first()).toBeVisible();
  await expect(page.locator("#atlasGridLimitPanel")).toBeVisible();
  await page.locator('[data-grid-limit="more"]').click();
});
test("picker search and close stay accessible while browsing the full real icon page", async ({ page }, info) => {
  await ready(page); await page.locator("#toolCalc").click(); await page.locator("#calculatorChooseGood").click();
  await expect(page.locator("#pickerGrid .pickerGood")).toHaveCount(60);
  const header = page.locator("#itemPickerDialog .atlasDialogHead"), before = await header.boundingBox();
  await page.locator("#itemPickerDialog .atlasDialogBody").evaluate(el => { el.scrollTop = el.scrollHeight; });
  const after = await header.boundingBox(); expect(after.y).toBe(before.y);
  const search = await page.locator(".pickerSearchBar").boundingBox(); expect(search.y).toBeGreaterThanOrEqual(after.y + after.height - 2);
  const last = page.locator("#pickerGrid .pickerGood").last(), id = await last.getAttribute("data-pick-good");
  await last.click(); await expect(page.locator("#calcTarget")).toHaveValue(id); await visibleBuild(page);
  await page.locator("#calculatorChooseGood").click(); await page.locator("#pickerSearch").fill("epichl");
  await expect(page.locator(`[data-pick-good="${target}"]`)).toBeVisible();
  await page.screenshot({ path: info.outputPath("nei-picker.png") });
  await page.keyboard.press("Escape"); await expect(page.locator("#calculatorChooseGood")).toBeFocused();
});
test("duplicate names retain visible exact IDs and support keyboard selection", async ({ page }) => {
  await ready(page); await page.locator("#toolCalc").click(); await page.locator("#calculatorChooseGood").click();
  await page.locator("#pickerSearch").fill("sweet coffee");
  await expect(page.locator("#pickerGrid .pickerGood")).toHaveCount(2);
  await expect(page.locator("#pickerGrid .pickerIdentity").first()).toBeVisible();
  const choices = page.locator("#pickerGrid .pickerGood"); expect(await choices.count()).toBeGreaterThan(1);
  const id = await choices.last().getAttribute("data-pick-good");
  await choices.first().focus(); await page.keyboard.press("End"); await expect(choices.last()).toBeFocused();
  await page.keyboard.press("Enter"); await expect(page.locator("#calcTarget")).toHaveValue(id);
  await expect(page.locator("#calcUnit")).toHaveValue(id.startsWith("f:") ? "L" : "items");
});
test("hiding the intro keeps its restore action compact and preserves the saved preference", async ({ page }) => {
  await ready(page); await page.locator("#seoIntroClose").click();
  await expect(page.locator("#seoIntro")).toBeHidden();
  await expect(page.locator("#seoIntroShow")).toBeVisible();
  if (page.viewportSize().width <= 700) {
    const restore = await page.locator("#seoIntroShow").boundingBox(), version = await page.locator("#toolDb").boundingBox();
    expect(Math.abs(restore.y - version.y)).toBeLessThan(24);
  }
  await page.reload(); await expect(page.locator('#bootLoader[data-state="ready"]')).toBeAttached();
  await expect(page.locator("#seoIntro")).toBeHidden();
  await page.locator("#seoIntroShow").click(); await expect(page.locator("#seoIntro")).toBeVisible();
});
