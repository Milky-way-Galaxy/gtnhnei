import { test, expect } from "@playwright/test";

test("short viewports keep complete form controls reachable beside persistent build actions", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("gtnhnei_help_seen", "1"));
  await page.goto("./");
  await expect(page.locator('#bootLoader[data-state="ready"]')).toBeAttached();
  await page.locator("#toolCalc").click();
  for (const width of [320, 740, 1440]) {
    await page.setViewportSize({ width, height: 360 });
    await page.locator('[data-calc-tab="planner"]').click();
    expect(await page.locator(".gtnhCalcWorkspace").evaluate(el => el.clientHeight)).toBeGreaterThanOrEqual(80);
    await page.locator("#calcClear").click();
    const build = await page.locator("#calcBuild").boundingBox();
    expect(build.height).toBeGreaterThanOrEqual(44);
    expect(build.y + build.height).toBeLessThanOrEqual(360);
    await page.locator("#calculatorChooseGood").click();
    await expect(page.locator('#itemPickerDialog [data-dialog-close]')).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("#calculatorChooseGood")).toBeFocused();
  }
});
