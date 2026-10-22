import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { localStorage.setItem("gtnhnei_help_seen", "1"); localStorage.setItem("gtnh_atlas_intro_hidden_v1", "1"); });
  await page.goto("./");
  await expect(page.locator('#bootLoader[data-state="ready"]')).toBeAttached();
});

test("primary navigation remains one reachable row from small phones to desktop", async ({ page }, info) => {
  for (const width of [320, 360, 393, 430, 768, 1280, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    const boxes = await Promise.all(["toolNei", "toolCalc", "toolFav", "toolMore"].map(id => page.locator(`#${id}`).boundingBox()));
    expect(new Set(boxes.map(box => box.y)).size).toBe(1);
    for (const box of boxes) { expect(box.height).toBeGreaterThanOrEqual(44); expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(width); }
    expect((await page.locator("#gtnhToolStrip").boundingBox()).height).toBeLessThanOrEqual(60);
    expect(await page.evaluate(() => document.body.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.setViewportSize({ width: 393, height: 844 });
  await page.screenshot({ path: info.outputPath("compact-toolbar.png") });
  await page.locator("#toolMore").click();
  await page.getByRole("menuitem", { name: "Help & shortcuts" }).click();
  await expect(page.locator("#gtnhHelpOverlay")).toBeVisible();
  await page.keyboard.press("Escape"); await expect(page.locator("#toolMore")).toBeFocused();
  await page.locator("#toolMore").click(); await page.getByRole("menuitem", { name: "Feedback" }).click();
  await expect(page.locator("#gtfbOverlay")).toHaveClass(/show/);
  await page.keyboard.press("Escape");
  await expect(page.locator("#gtnhToolStrip > button")).toHaveCount(4);
});

test("version dropdown is anchored, marks the active dataset and supports keyboard dismissal", async ({ page }) => {
  const trigger = page.locator("#toolNei"), menu = page.getByRole("menu", { name: "Recipe version" });
  await trigger.focus(); await page.keyboard.press("ArrowDown");
  await expect(menu).toBeVisible(); await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expect(menu.getByRole("menuitemradio", { checked: true })).toBeFocused();
  await expect(menu.getByRole("menuitemradio", { name: /2.8.4/ })).toBeDisabled();
  const anchor = await trigger.boundingBox(), dropdown = await menu.boundingBox();
  expect(dropdown.y).toBeGreaterThanOrEqual(anchor.y + anchor.height);
  expect(dropdown.y + dropdown.height).toBeLessThanOrEqual(page.viewportSize().height);
  await page.keyboard.press("ArrowDown"); await expect(menu.getByRole("menuitemradio", { name: /2.9.0/ })).toBeFocused();
  await page.keyboard.press("Escape"); await expect(menu).toBeHidden(); await expect(trigger).toBeFocused();
  await page.keyboard.press("ArrowDown"); await page.keyboard.press("Tab");
  await expect(menu).toBeHidden(); await expect(page.locator("#toolCalc")).toBeFocused();
  await trigger.click(); await page.mouse.click(page.viewportSize().width - 2, page.viewportSize().height - 2);
  await expect(menu).toBeHidden(); await expect(trigger).toHaveAttribute("aria-expanded", "false");
});

test("long version lists scroll inside short viewports without exposing unverified data as selectable", async ({ page }, info) => {
  // UI-only fixture: these entries have no data and never ship in the manifest.
  await page.evaluate(() => {
    const data = window.GTNH_DATASETS;
    data.manifest.datasets.push(...Array.from({ length: 24 }, (_, i) => ({ id: `test-unavailable-${i}`, label: `Archive test ${i}`, available: false, reason: "UI test only; no recipe dataset." })));
  });
  for (const size of [{ width: 320, height: 360 }, { width: 740, height: 360 }, { width: 1440, height: 500 }]) {
    await page.setViewportSize(size); await page.locator("#toolNei").click();
    const menu = page.locator("#gtnhNeiDrop"), box = await menu.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(size.width);
    expect(box.y).toBeGreaterThanOrEqual(0); expect(box.y + box.height).toBeLessThanOrEqual(size.height);
    expect(await menu.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true);
    await page.keyboard.press("End"); await expect(menu.getByRole("menuitem", { name: /Dataset source/ })).toBeFocused();
    expect(await menu.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
    await page.screenshot({ path: info.outputPath(`versions-${size.width}.png`) });
    await page.keyboard.press("Escape");
  }
});

test("Feedback uses a named modal, labelled fields and restores toolbar focus", async ({ page }) => {
  await page.locator("#toolMore").click(); await page.locator("#gtfbOpen").click();
  const dialog = page.getByRole("dialog", { name: "Feedback", exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("#gtfbBugTitle")).toHaveAccessibleName("Title");
  await dialog.getByRole("button", { name: "Close feedback" }).focus();
  // Modal inertness must block attempts to focus the search behind the dialog.
  await page.locator("#search").evaluate(el => el.focus());
  await expect(dialog.getByRole("button", { name: "Close feedback" })).toBeFocused();
  await page.keyboard.press("Escape"); await expect(dialog).toBeHidden();
  await expect(page.locator("#toolMore")).toBeFocused();
});

test("version menus remain usable without native popover support", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(HTMLElement.prototype, "showPopover", { value: undefined, configurable: true }));
  await page.reload(); await expect(page.locator('#bootLoader[data-state="ready"]')).toBeAttached();
  await page.locator("#toolNei").click(); await expect(page.locator("#gtnhNeiDrop")).toBeVisible();
  await expect(page.locator('#gtnhNeiDrop [aria-checked="true"]')).toBeFocused();
  await page.keyboard.press("Escape"); await expect(page.locator("#gtnhNeiDrop")).toBeHidden();
  await expect(page.locator("#toolNei")).toBeFocused();
});
