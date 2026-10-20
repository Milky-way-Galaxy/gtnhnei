import { test as base, expect } from "@playwright/test";
import { gzipSync } from "node:zlib";

const test = base.extend({
  page: async ({ page }, use) => {
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.addInitScript(() => {
      localStorage.setItem("gtnhnei_help_seen", "1");
      localStorage.setItem("gtnh_atlas_item_grid_mode_v3", "manual");
      localStorage.setItem("gtnh_atlas_item_grid_limit_v3", "420");
      window.apiEvents = [];
      for (const type of ["gtnhnei-icons-ready", "gtnhnei-data-api-ready", "gtnhnei-live-card-api-ready", "gtnhnei-flow-export-ready"]) {
        window.addEventListener(type, () => window.apiEvents.push(type));
      }
    });
    await use(page);
    expect(errors, "Uncaught browser exceptions").toEqual([]);
  }
});

async function ready(page) {
  await expect(page.locator('#bootLoader[data-state="ready"]')).toBeAttached();
  await expect(page.locator("#search")).toBeEnabled();
  await expect(page.locator("#grid .slot").first()).toBeVisible();
}

async function matchesQuery(page, query) {
  return page.evaluate(async query => {
    const { Repository, Item, Fluid } = await import(window.GTNH_MODULE_URL("./dist/repository.js"));
    const { SearchQuery } = await import("./dist/searchQuery.js");
    const repo = Repository.current;
    const goods = [...repo.items].map(ptr => repo.GetObject(ptr, Item))
      .concat([...repo.fluids].map(ptr => repo.GetObject(ptr, Fluid)));
    const expected = goods.filter(obj => repo.IsObjectMatchingSearch(obj, new SearchQuery(query))).map(obj => obj.name);
    const actual = [...document.querySelectorAll("#grid .slot")].map(slot => slot.title);
    return { correct: actual.every((title, index) => title === expected[index]), total: expected.length, rendered: actual.length };
  }, query);
}

test("startup renders bounded batches and initializes every data API once", async ({ page }) => {
  let downloads = 0;
  page.on("request", request => { if (request.url().endsWith("/data/data.bin")) downloads++; });
  await page.goto("./");
  await ready(page);
  const count = await page.locator("#grid .slot").count();
  const limit = await page.evaluate(() => Number(localStorage.getItem("gtnh_atlas_item_grid_limit_v3")));
  expect(count).toBeLessThanOrEqual(limit);
  expect(count).toBeLessThan(10000);
  expect(await page.evaluate(() => window.GTNHNEI_DATA_API.count)).toBe(42633);
  expect(await page.evaluate(() => window.apiEvents)).toEqual([
    "gtnhnei-icons-ready", "gtnhnei-data-api-ready", "gtnhnei-live-card-api-ready", "gtnhnei-flow-export-ready"
  ]);
  expect(await page.evaluate(() => window.GTNHNEI_FLOW_EXPORT_API.version)).toBe(2);
  expect(await page.evaluate(() => window.GTNHNEI_FLOW_EXPORT_API.__makerChoiceWrapped)).toBe(true);
  expect(downloads).toBe(1);
});

test("filtered grid growth preserves matches, existing nodes, and scroll position without reloading", async ({ page }) => {
  let navigations = 0;
  page.on("framenavigated", frame => { if (frame === page.mainFrame()) navigations++; });
  await page.goto("./");
  await ready(page);
  await page.locator("#search").fill("dust @greg");
  await expect(page.locator("#status")).toContainText("result(s)");
  await page.evaluate(() => { window.firstSlot = document.querySelector("#grid .slot"); });
  const oldLimit = await page.evaluate(() => Number(localStorage.getItem("gtnh_atlas_item_grid_limit_v3")));
  await page.locator('[data-grid-limit="more"]').click();
  expect(await page.evaluate(() => Number(localStorage.getItem("gtnh_atlas_item_grid_limit_v3")))).toBe(oldLimit + 420);
  expect(await page.evaluate(() => window.firstSlot === document.querySelector("#grid .slot"))).toBe(true);
  for (let i = 0; i < 4; i++) {
    const before = await page.locator("#grid .slot").count();
    if (before === (await matchesQuery(page, "dust @greg")).total) break;
    await page.locator("#grid").evaluate(grid => { grid.scrollTop = grid.scrollHeight; });
    await expect.poll(() => page.locator("#grid .slot").count()).toBeGreaterThan(before);
  }
  const results = await matchesQuery(page, "dust @greg");
  expect(results.correct).toBe(true);
  expect(results.rendered).toBeGreaterThan(840);
  expect(results.total).toBeGreaterThanOrEqual(results.rendered);
  expect(await page.locator("#grid").evaluate(grid => grid.scrollTop)).toBeGreaterThan(0);
  expect(navigations).toBe(1);
  await page.locator('[data-grid-limit="1000"]').click();
  expect((await matchesQuery(page, "dust @greg")).correct).toBe(true);
});

test("empty results and limit controls do not trigger reload loops", async ({ page }) => {
  await page.goto("./");
  await ready(page);
  await page.locator("#search").fill("no_such_item_9876543210");
  await expect(page.locator("#grid")).toHaveText("No results");
  await page.locator('[data-grid-limit="more"]').click();
  await page.setViewportSize({ width: 400, height: 900 });
  await expect(page.locator("#grid .slot")).toHaveCount(0);
  await expect(page.locator("#status")).toContainText("0 result(s)");
  await page.locator("#clear").click();
  await expect(page.locator("#grid .slot").first()).toBeVisible();
});

test("production, usage, machine tabs, navigation, live cards, and YAML still work", async ({ page }) => {
  await page.goto("./");
  await ready(page);
  expect(await page.evaluate(() => window.GTNHNEI_MAIN_API.recipe("Iron Ingot"))).toBe(true);
  await expect(page.locator("#recipePage .recipe").first()).toBeVisible();
  const count = await page.locator("#recipePage .recipe").count();
  expect(count).toBeLessThanOrEqual(24);
  await page.locator("#machineTabs .tab").last().click();
  await expect(page.locator("#recipePage .recipe").first()).toBeVisible();
  await page.locator("#navBack").click();
  await expect(page.locator("#grid .slot").first()).toBeVisible();
  await page.locator("#navForward").click();
  await expect(page.locator("#recipePage .recipe").first()).toBeVisible();
  expect(await page.evaluate(() => window.GTNHNEI_MAIN_API.usage("Iron Ingot"))).toBe(true);
  await expect(page.locator("#status")).toContainText("Usage: Iron Ingot");
  const integration = await page.evaluate(() => {
    const recipe = window.GTNHNEI_DATA_API.production("Electric Blast Furnace");
    const mount = document.createElement("div");
    const mounted = window.GTNHNEI_LIVE_RECIPE_CARD_API.mountProduction("Electric Blast Furnace", 0, mount);
    const yaml = window.GTNHNEI_FLOW_EXPORT_API.yamlForRecipe("Electric Blast Furnace", 0);
    return { count: recipe.count, mounted, cards: mount.querySelectorAll(".recipe").length, yaml: yaml.yaml };
  });
  expect(integration.count).toBe(3);
  expect(integration.mounted).toBe(true);
  expect(integration.cards).toBe(1);
  expect(integration.yaml).toContain("- m:");
});

test("a download delayed past 25 seconds keeps the app intact and initializes late APIs", async ({ page }) => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route("**/data/data.bin", async route => { await gate; await route.continue(); });
  await page.goto("./");
  await expect(page.locator("#search")).toBeDisabled();
  await expect(page.locator(".bootNote")).toContainText("Loading is still in progress", { timeout: 30000 });
  await expect(page.locator(".app")).toBeAttached();
  await expect(page.locator("#bootLoader")).toBeVisible();
  release();
  await ready(page);
  expect(await page.evaluate(() => window.GTNHNEI_FLOW_EXPORT_API.__makerChoiceWrapped)).toBe(true);
  expect(await page.evaluate(() => window.GTNHNEI_LIVE_RECIPE_CARD_API.ready)).toBe(true);
});

for (const failure of ["http", "gzip", "version"]) {
  test(`a ${failure} failure shows an error and retries successfully in the same page`, async ({ page }) => {
    let attempts = 0;
    await page.route("**/data/data.bin", async route => {
      if (++attempts > 1) { await route.continue(); return; }
      if (failure === "http") await route.fulfill({ status: 503, body: "Unavailable" });
      if (failure === "gzip") await route.fulfill({ body: Buffer.from("corrupt database") });
      if (failure === "version") await route.fulfill({ body: gzipSync(new Uint8Array(32)) });
    });
    await page.goto("./");
    await expect(page.locator('#bootLoader[data-state="error"]')).toBeVisible();
    await expect(page.locator(".bootMsg")).toContainText(failure === "http" ? "HTTP 503" : failure === "gzip" ? "incomplete or damaged" : "Unsupported data version");
    await expect(page.locator("#search")).toBeDisabled();
    await page.locator("#bootRetry").click();
    await ready(page);
    expect(attempts).toBe(2);
    expect(await page.evaluate(() => window.apiEvents.length)).toBe(4);
  });
}

test("unsupported gzip browsers get a visible compatibility error", async ({ page }) => {
  await page.addInitScript(() => { window.DecompressionStream = undefined; });
  await page.goto("./");
  await expect(page.locator('#bootLoader[data-state="error"]')).toBeVisible();
  await expect(page.locator(".bootMsg")).toContainText("current browser");
});

test("planner tabs and flow panning retain horizontal scroll after DOM updates", async ({ page }) => {
  await page.goto("./");
  await ready(page);
  await page.locator("#toolCalc").click();
  await expect(page.locator("#gtnhCalcOverlay")).toBeVisible();
  await page.evaluate(() => {
    const overlay = document.getElementById("gtnhCalcOverlay");
    const scroller = document.createElement("div");
    scroller.id = "regressionTabs";
    scroller.style.cssText = "width:120px;overflow:auto";
    scroller.innerHTML = '<div style="width:900px;height:40px">Tabs</div>';
    const viewer = scroller.cloneNode(true);
    viewer.id = "regressionViewer";
    viewer.className = "gtnhFlowBrowserViewer";
    overlay.append(scroller, viewer);
    scroller.scrollLeft = 100;
    viewer.scrollLeft = 100;
    overlay.appendChild(document.createElement("span"));
  });
  // Cover several cycles of the old 80ms observer loop.
  await page.waitForTimeout(500);
  expect(await page.locator("#regressionTabs").evaluate(node => node.scrollLeft)).toBe(100);
  expect(await page.locator("#regressionViewer").evaluate(node => node.scrollLeft)).toBe(100);
  const viewport = await page.evaluate(() => ({ width: innerWidth, body: document.body.scrollWidth }));
  expect(viewport.body).toBeLessThanOrEqual(viewport.width);
});
