import { test, expect } from "@playwright/test";
const iron = "i:minecraft:iron_ingot:0";
async function ready(page) { await expect(page.locator('#bootLoader[data-state="ready"]')).toBeAttached(); }
for (const version of ["2.8.0", "2.9.0"]) test(`a saved ${version} version reloads, searches and calculates with the network disconnected`, async ({ page, context }, info) => {
  test.setTimeout(120000);
  const errors = []; page.on("pageerror", error => errors.push(error.message));
  await page.goto(`./?dataset=gtnh-${version}&item=${encodeURIComponent(iron)}`); await ready(page);
  await page.locator("#favoriteCurrentItem").click();
  await page.locator("#toolOffline").click(); await page.locator("#offlineSave").click();
  await expect(page.locator("#offlineStatus")).toContainText("Saved. You can reload", { timeout: 60000 });
  await expect(page.locator("#offlineDetails")).toContainText("ready for offline");
  await page.keyboard.press("Escape");
  await context.setOffline(true); await page.reload(); await ready(page);
  expect(await page.evaluate(() => window.GTNH_DATABASE_LOAD.source)).toBe("cache");
  await page.locator("#planCurrentItem").click();
  expect(await page.evaluate(() => window.GTNH_CALC.getPlan().target.id)).toBe(iron);
  await page.locator("#gtnhCalcClose").click(); await page.locator("#toolFav").click();
  await expect(page.locator("#itemLibraryList")).toContainText(iron);
  await page.screenshot({ path: info.outputPath(`offline-${version}-item-library.png`) }); await page.keyboard.press("Escape");
  // An unsaved pack must fail visibly; it cannot borrow the other pack's data.
  const missing = version === "2.8.0" ? "2.9.0" : "2.8.0";
  await page.goto(`./?dataset=gtnh-${missing}`); await expect(page.locator('#bootLoader[data-state="error"]')).toBeAttached();
  await expect(page.locator(".bootMsg")).toContainText("download");
  if (version === "2.8.0") await page.locator("#bootResetDataset").click();
  else await page.goto(`./?dataset=gtnh-${version}`);
  await ready(page);
  expect(await page.evaluate(() => window.GTNH_CATALOG.dataset.id)).toBe(`gtnh-${version}`);
  expect(errors).toEqual([]);
});
test("offline app updates wait for acceptance, reload safely and retire old shells", async ({ page }) => {
  test.setTimeout(120000); await page.goto("./"); await ready(page);
  await page.evaluate(async () => {
    const { saveOffline } = await import("./offline.js"); await saveOffline(window.GTNH_DATASETS.active);
    localStorage.setItem("atlas-update-preserve-test", "keep");
    await caches.open("gtnh-atlas-shell-previous-test");
    // A new script URL models a deployed worker revision without changing files
    // under another running browser test. The real install/activate code runs.
    window.updateRegistration = await navigator.serviceWorker.register(new URL("service-worker.js?new-build-test=1", location.href), { type: "module", scope: new URL("./", location.href).pathname, updateViaCache: "none" });
  });
  await expect.poll(() => page.evaluate(() => !!window.updateRegistration.waiting)).toBe(true);
  await page.locator("#toolOffline").click(); await expect(page.locator("#offlineUpdate")).toBeVisible();
  const navigation = page.waitForEvent("framenavigated", frame => frame === page.mainFrame());
  await page.locator("#offlineUpdate").click(); await navigation; await ready(page);
  expect(await page.evaluate(() => localStorage.getItem("atlas-update-preserve-test"))).toBe("keep");
  expect(await page.evaluate(() => window.GTNH_DATABASE_LOAD.source)).toBe("cache");
  expect(await page.evaluate(async () => (await caches.keys()).includes("gtnh-atlas-shell-previous-test"))).toBe(false);
});
test("removing downloads retains plans and favorites and a wrong icon hash is rejected", async ({ page }) => {
  test.setTimeout(120000); await page.goto("./"); await ready(page);
  const result = await page.evaluate(async () => {
    const { saveOffline, removeOfflineDataset, offlineStatus } = await import("./offline.js");
    const dataset = window.GTNH_DATASETS.active;
    localStorage.setItem("gtnh_atlas_planner_v1_gtnh-2.8.0", "keep-plan");
    let error;
    try { await saveOffline({ ...dataset, atlasSha256: "0".repeat(64) }); } catch (failure) { error = failure.message; }
    const wrong = await offlineStatus({ ...dataset, atlasSha256: "0".repeat(64) });
    await removeOfflineDataset(dataset);
    return { error, wrongIcons: wrong.icons, recipes: (await offlineStatus(dataset)).recipes, plan: localStorage.getItem("gtnh_atlas_planner_v1_gtnh-2.8.0") };
  });
  expect(result.error).toContain("checksum"); expect(result.wrongIcons).toBe(false); expect(result.recipes).toBeUndefined(); expect(result.plan).toBe("keep-plan");
});
