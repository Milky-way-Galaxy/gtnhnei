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
test("About Atlas reopens and closes repeatedly and preserves the existing visibility preference", async ({ page }) => {
  await ready(page); await page.locator("#seoIntroClose").click();
  await expect(page.locator("#seoIntro")).toBeHidden();
  await expect(page.locator("#seoIntroShow")).toHaveCount(0);
  await page.reload(); await expect(page.locator('#bootLoader[data-state="ready"]')).toBeAttached();
  await expect(page.locator("#seoIntro")).toBeHidden();
  for (let cycle = 0; cycle < 3; cycle++) {
    await page.locator("#toolMore").click();
    await page.getByRole("menuitem", { name: "About Atlas" }).click();
    await expect(page.locator("#seoIntro")).toBeVisible();
    await expect(page.locator("#seoIntroClose")).toBeFocused();
    await page.locator("#seoIntroClose").click();
    await expect(page.locator("#seoIntro")).toBeHidden();
    await expect(page.locator("#toolMore")).toBeFocused();
  }
  expect(await page.evaluate(() => localStorage.getItem("gtnh_atlas_intro_hidden_v1"))).toBe("1");
});

test("recipe headings and primary actions stay visible without sideways dragging", async ({ page }, info) => {
  await ready(page, "?dataset=gtnh-2.9.0&item=i%3ABotania%3Astorage%3A3&view=usage");
  await expect(page.locator("#recipeItemName")).toHaveText("Block of Mana Diamond");
  for (const width of [320, 360, 393, 430, 768, 1280, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    for (const locator of [page.locator("#recipeItemName"), page.locator("#toggleRecipeView"), page.locator("#planCurrentItem"), page.locator("#favoriteCurrentItem"), page.locator("#recipeMoreActions")]) {
      const box = await locator.boundingBox(); expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(width);
    }
    expect(await page.locator("#breadcrumb").evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  }
  await page.setViewportSize({ width: 393, height: 844 });
  await page.locator("#recipeMoreActions").click(); await expect(page.locator("#recipeItemMenu")).toBeVisible();
  await page.keyboard.press("Escape"); await expect(page.locator("#recipeMoreActions")).toBeFocused();
  await page.locator("#toggleRecipeView").click(); await expect(page.locator("#recipeItemName")).toHaveText("Block of Mana Diamond");
  await page.locator("#planCurrentItem").click();
  await expect(page.locator("#plannerOverview")).toBeFocused();
  // Authentic 2.9 Compressor route: one block, 15 s, 2 EU/t, 600 EU.
  expect(await page.evaluate(() => ({ energy: window.GTNH_CALC.getPlan().knownEnergy, time: window.GTNH_CALC.getPlan().rootTimeSeconds }))).toEqual({ energy: 600, time: 15 });
  await expect(page.locator(".plannerDataset")).toContainText("1 item · GTNH 2.9.0");
  const material = await page.locator("#plannerMaterialRows tbody tr").first().boundingBox();
  expect(material.y).toBeGreaterThanOrEqual(0); expect(material.y + material.height).toBeLessThan(780);
  expect(await page.locator(".gtnhCalcWorkspace").evaluate(el => el.scrollTop)).toBe(0);
  await page.screenshot({ path: info.outputPath("compact-material-results.png") });
});

test("authentic 9 by 9 recipes retain every slot and scroll within the card on phones", async ({ page }) => {
  await ready(page, "?dataset=gtnh-2.9.0");
  const source = await page.evaluate(async () => {
    const { Recipe, RecipeIoType } = await import(window.GTNH_MODULE_URL("./dist/repository.js"));
    const repo = window.GTNH_CATALOG.repository;
    for (const pointer of repo.recipes) {
      const recipe = repo.GetObject(pointer, Recipe), dims = recipe.recipeType.dimensions;
      if (dims[0] !== 9 || dims[1] !== 9) continue;
      const output = recipe.items.find(io => io.type === RecipeIoType.ItemOutput);
      if (!output) continue;
      return { recipeId: recipe.id, goodId: output.goods.id,
        occupied: recipe.items.filter(io => [RecipeIoType.ItemInput, RecipeIoType.OreDictInput].includes(io.type)).map(io => io.slot) };
    }
    throw new Error("The verified 2.9 dataset has no 9 by 9 recipe to check.");
  });
  await ready(page, `?dataset=gtnh-2.9.0&item=${encodeURIComponent(source.goodId)}&recipe=${encodeURIComponent(source.recipeId)}`);
  const card = page.locator("#recipePage .recipe"), grid = card.locator(".neiSubGrid").first();
  await expect(card).toHaveCount(1); await expect(grid.locator(".neiSlot")).toHaveCount(81);
  const actual = await grid.locator(".neiSlot").evaluateAll(slots => slots.flatMap((slot, index) => slot.classList.contains("emptySlot") ? [] : [index]));
  expect(actual).toEqual([...new Set(source.occupied)].sort((a, b) => a - b));
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await grid.evaluate(el => getComputedStyle(el).gridTemplateColumns.split(" ").length)).toBe(9);
    expect(await page.locator("#recipePage").evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    if (width === 320) {
      const body = card.locator(".neiRecipeBody");
      expect(await body.evaluate(el => { el.scrollLeft = el.scrollWidth; return el.scrollLeft; })).toBeGreaterThan(0);
      expect(await page.evaluate(() => document.body.scrollWidth <= innerWidth)).toBe(true);
    }
  }
});
