import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("gtnhnei_help_seen", "1"));
  await page.goto("./");
  await expect(page.locator('#bootLoader[data-state="ready"]')).toBeAttached();
});

async function discover(page) {
  await page.locator("#search").fill("lunaloves.");
  await expect(page.locator("#lunaEggOverlay")).toBeVisible();
}

test("secret search opens a contained modal and Escape restores search focus", async ({ page }) => {
  await discover(page);
  await expect(page.getByRole("dialog", { name: "lunaloves. Statue" })).toBeVisible();
  await expect(page.locator(".lunaFiction")).toContainText("Not available in GTNH");
  await expect(page.locator("#lunaClose")).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(page.locator("#lunaShare")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.locator("#lunaClose")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.locator("#lunaEggOverlay")).toBeHidden();
  await expect(page.locator("#search")).toBeFocused();
});

test("assembly is playful, reversible and leaves user plans untouched", async ({ page }) => {
  await discover(page);
  const before = await page.evaluate(() => JSON.stringify(localStorage));
  await page.locator("#lunaAssemble").click();
  await expect(page.locator("#lunaAssemblyStatus")).toContainText("Statue assembled!");
  await expect(page.locator("#lunaEggOverlay")).toHaveClass("assembled");
  await page.locator("#lunaAssemble").click();
  await expect(page.locator("#lunaAssemblyStatus")).toContainText("Ready when you are");
  expect(await page.evaluate(() => JSON.stringify(localStorage))).toBe(before);
});

test("narrow and short layouts keep close reachable and all content inside the modal", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 480 });
  await discover(page);
  await page.locator("#lunaShare").scrollIntoViewIfNeeded();
  const geometry = await page.locator("#lunaEggOverlay").evaluate(el => ({
    overflow: el.scrollWidth > el.clientWidth + 1,
    close: document.getElementById("lunaClose").getBoundingClientRect().toJSON(),
    dialog: el.getBoundingClientRect().toJSON()
  }));
  expect(geometry.overflow).toBe(false);
  expect(geometry.close.top).toBeGreaterThanOrEqual(geometry.dialog.top);
  expect(geometry.close.bottom).toBeLessThan(480);
  await page.locator("#lunaClose").click();
  await expect(page.locator("#lunaEggOverlay")).toBeHidden();
});

test("secret links open directly and copied recipe is explicitly fictional", async ({ page, context, browserName }) => {
  test.skip(browserName !== "chromium", "Clipboard read/write permission grants are Chromium-specific.");
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("./?lunaloves=1&ref=not-shared#not-shared");
  await expect(page.locator("#lunaEggOverlay")).toBeVisible();
  await page.locator("#lunaCopyRecipe").click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain("FICTIONAL EASTER EGG");
  await page.locator("#lunaShare").click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe("http://127.0.0.1:4173/gtnhnei/?lunaloves=1");
});

test("ingredients still open real NEI recipes and Back returns to the egg", async ({ page }) => {
  await discover(page);
  await page.locator('[data-luna-name="Microprocessor"]').click();
  await expect(page.locator("#lunaEggOverlay")).toBeHidden();
  await page.locator("#navBack").click();
  await expect(page.locator("#lunaEggOverlay")).toBeVisible();
});
