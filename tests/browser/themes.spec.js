import { test, expect } from "@playwright/test";
const mana = "i:Botania:storage:3";
async function ready(page) {
  await page.goto(`./?dataset=gtnh-2.9.0&item=${encodeURIComponent(mana)}&view=usage`);
  await expect(page.locator('#bootLoader[data-state="ready"]')).toBeAttached();
}
async function picker(page) {
  await page.locator("#toolMore").click(); await page.locator("#toolTheme").click();
  return page.getByRole("dialog", { name: "Theme", exact: true });
}

test("themes switch real recipe surfaces without changing quantities, plans or exports and survive reload", async ({ page }, info) => {
  await ready(page);
  const recipeRows = () => page.locator("#recipePage .recipe").evaluateAll(cards => cards.map(card => ({ id: card.dataset.recipeId, amounts: [...card.querySelectorAll(".neiAmount")].map(el => el.textContent) })));
  const originalRows = await recipeRows();
  await page.locator("#planCurrentItem").click();
  const original = await page.evaluate(() => ({ state: window.GTNH_CALC.getState(), plan: window.GTNH_CALC.getPlan(), yaml: window.GTNH_CALC.exportYaml() }));
  await page.locator("#gtnhCalcClose").click();
  for (const [id, name] of [["graphite", "Graphite"], ["atlas-classic", "Atlas Classic"], ["nei-classic", "NEI Classic"]]) {
    const dialog = await picker(page);
    await dialog.getByRole("radio", { name, exact: true }).check();
    await expect(page.locator("html")).toHaveAttribute("data-theme", id);
    await page.keyboard.press("Escape"); await expect(page.locator("#toolMore")).toBeFocused();
    expect(await recipeRows()).toEqual(originalRows);
    expect(await page.evaluate(() => ({ state: window.GTNH_CALC.getState(), plan: window.GTNH_CALC.getPlan(), yaml: window.GTNH_CALC.exportYaml() }))).toEqual(original);
    await page.screenshot({ path: info.outputPath(`recipes-${id}.png`) });
  }
  await page.reload(); await expect(page.locator('#bootLoader[data-state="ready"]')).toBeAttached();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "nei-classic");
  expect(await page.evaluate(() => window.GTNH_CALC.getState())).toEqual(original.state);
  await page.locator("#toolCalc").click(); await page.locator("#calcBuild").click();
  expect(await page.evaluate(() => window.GTNH_CALC.getPlan().knownEnergy)).toBe(600);
});

test("invalid saved themes recover and storage failure keeps a usable session theme", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("gtnh_atlas_theme_v1", "retired-theme"));
  await ready(page); await expect(page.locator("html")).toHaveAttribute("data-theme", "graphite");
  const result = await page.evaluate(() => {
    let message; try { window.GTNH_THEME.select("missing-theme"); } catch (error) { message = error.message; }
    Object.defineProperty(window, "localStorage", { get() { throw new DOMException("Storage disabled", "SecurityError"); } });
    return { message, theme: window.GTNH_THEME.current };
  });
  expect(result).toEqual({ message: "Unknown Atlas theme.", theme: "graphite" });
  const dialog = await picker(page);
  await dialog.getByRole("radio", { name: "Atlas Classic", exact: true }).check();
  await expect(dialog.locator("#atlasThemeStatus")).toContainText("Applied for this tab");
  await page.keyboard.press("Escape");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "atlas-classic");
  await page.locator("#toolNei").click(); await expect(page.locator("#gtnhNeiDrop")).toBeVisible();
});

test("downloaded app themes work offline and keyboard selection stays in the theme dialog", async ({ page, context }) => {
  test.setTimeout(120000);
  await ready(page);
  await page.evaluate(async () => { const { saveOffline } = await import(window.GTNH_MODULE_URL("./offline.js")); await saveOffline(window.GTNH_DATASETS.active); window.GTNH_THEME.select("atlas-classic"); });
  await context.setOffline(true); await page.reload(); await expect(page.locator('#bootLoader[data-state="ready"]')).toBeAttached();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "atlas-classic");
  const dialog = await picker(page), current = dialog.getByRole("radio", { name: "Atlas Classic", exact: true });
  await expect(current).toBeFocused(); await page.keyboard.press("ArrowRight");
  await expect(dialog.getByRole("radio", { name: "NEI Classic", exact: true })).toBeChecked();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "nei-classic");
  await page.keyboard.press("Escape"); await expect(page.locator("#toolMore")).toBeFocused();
  await page.locator("#planCurrentItem").click(); expect(await page.evaluate(() => window.GTNH_CALC.getPlan().knownEnergy)).toBe(600);
});
