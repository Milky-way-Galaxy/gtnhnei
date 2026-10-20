import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
const iron = "i:minecraft:iron_ingot:0";
async function ready(page) { await expect(page.locator('#bootLoader[data-state="ready"]')).toBeAttached(); }
test("favorites, recent history and library actions retain exact good IDs", async ({ page }, info) => {
  await page.goto(`./?item=${encodeURIComponent(iron)}`); await ready(page);
  await expect(page.locator("#favoriteCurrentItem")).toHaveAttribute("aria-pressed", "false");
  await page.locator("#favoriteCurrentItem").click();
  await page.locator("#toolFav").click();
  const dialog = page.locator("#itemLibraryDialog");
  await expect(dialog.locator(".libraryRow")).toHaveCount(1);
  await expect(dialog.locator(".libraryGood")).toContainText(iron);
  await page.evaluate(() => { navigator.clipboard.writeText = async text => { window.copiedLibraryName = text; }; });
  await dialog.locator('[data-library-action="copy"]').click();
  expect(await page.evaluate(() => window.copiedLibraryName)).toBe("Iron Ingot");
  await dialog.locator('[data-library-action="usage"]').click();
  await expect(page.locator("#status")).toContainText("Usage: Iron Ingot");
  await page.locator("#toolFav").click(); await dialog.locator('[data-library-tab="recent"]').click();
  await expect(dialog.locator(".libraryRow")).toHaveCount(1);
  const mode = await page.evaluate(async () => {
    const { ItemLibrary } = await import("./item-library.js"); return new ItemLibrary(window.GTNH_CATALOG, localStorage).read().recent[0].mode;
  });
  expect(mode).toBe("usage");
  await page.screenshot({ path: info.outputPath("item-library.png") });
  await dialog.locator('[data-library-action="plan"]').click();
  await expect(page.locator("#gtnhCalcOverlay")).toBeVisible();
  expect(await page.evaluate(() => window.GTNH_CALC.getState().target)).toBe(iron);
});
test("name collisions remain separate favorites and legacy unknown names are preserved", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("gtnhnei_favorites_v2", JSON.stringify([{ name: "A missing old favorite", addedAt: 7 }])));
  await page.goto("./"); await ready(page);
  const ids = await page.evaluate(() => [...window.GTNH_CATALOG.byName.values()].find(rows => rows.length > 1).slice(0, 2).map(good => good.id));
  for (const id of ids) {
    await page.evaluate(id => window.GTNHNEI_MAIN_API.recipe(id), id);
    await expect(page.locator("#favoriteCurrentItem")).toBeVisible();
    await page.locator("#favoriteCurrentItem").click();
  }
  await page.locator("#toolFav").click();
  const rows = page.locator("#itemLibraryList .libraryRow"); await expect(rows).toHaveCount(3);
  for (const id of ids) expect(await rows.locator(".libraryGood > small:first-of-type").allTextContents()).toContain(id);
  const legacy = rows.filter({ hasText: "A missing old favorite" });
  await expect(legacy).toContainText("Legacy name"); await expect(legacy.locator('[data-library-action="production"]')).toBeDisabled();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("gtnhnei_favorites_v2")))).toEqual([{ name: "A missing old favorite", addedAt: 7 }]);
});
test("library JSON exports round-trip and foreign revisions cannot overwrite it", async ({ page }) => {
  await page.goto(`./?item=${encodeURIComponent(iron)}`); await ready(page); await page.locator("#favoriteCurrentItem").click(); await page.locator("#toolFav").click();
  const downloadEvent = page.waitForEvent("download"); await page.locator("#libraryExport").click();
  const file = await downloadEvent, text = await readFile(await file.path(), "utf8"), value = JSON.parse(text);
  expect(value.favorites[0].id).toBe(iron); expect(value.dataset.id).toBe("gtnh-2.8.0");
  value.dataset.id = "gtnh-2.9.0";
  await page.locator("#libraryImport").setInputFiles({ name: "wrong-version.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(value)) });
  await expect(page.locator("#itemLibraryStatus")).toContainText("different recipe dataset");
  await page.locator("#libraryImport").setInputFiles({ name: "library.json", mimeType: "application/json", buffer: Buffer.from(text) });
  await expect(page.locator("#itemLibraryList .libraryRow")).toHaveCount(1);
});
test("toolbar fits the viewport and native dialogs keep keyboard focus", async ({ page }, info) => {
  await page.goto("./"); await ready(page);
  const geometry = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, pageWidth: document.documentElement.scrollWidth, bottom: document.querySelector(".app").getBoundingClientRect().bottom, gridHeight: document.querySelector("#grid").clientHeight, buttons: [...document.querySelectorAll("#gtnhToolStrip > button")].map(button => button.getBoundingClientRect().width) }));
  expect(geometry.pageWidth).toBeLessThanOrEqual(geometry.width); expect(geometry.bottom).toBeLessThanOrEqual(geometry.height);
  expect(geometry.gridHeight).toBeGreaterThan(100); expect(geometry.buttons.every(width => width >= 44)).toBe(true);
  await page.screenshot({ path: info.outputPath("workspace-home.png") });
  await page.locator("#toolFav").click();
  await page.locator('#itemLibraryDialog [data-dialog-close]').focus(); await page.keyboard.press("/");
  await expect(page.locator('#itemLibraryDialog [data-dialog-close]')).toBeFocused();
  await page.keyboard.press("Escape"); await expect(page.locator("#toolFav")).toBeFocused();
  await page.keyboard.press("p"); await expect(page.locator("#gtnhCalcOverlay")).toBeVisible();
});
