import { test, expect } from "@playwright/test";
for (const version of ["2.8.0", "2.9.0"]) test(`real ${version} returned-cell loop requires explicit stock and exports format 4`, async ({ page }, info) => {
  test.setTimeout(90000);
  await page.goto(`./?dataset=gtnh-${version}`); await expect(page.locator('#bootLoader[data-state="ready"]')).toBeAttached(); await page.locator("#toolCalc").click();
  const anchor = await page.evaluate(version => {
    const catalog = window.GTNH_CATALOG, target = "f:gregtech:tetranitromethane", empty = "i:IC2:itemCellEmpty:0", filled = "i:gregtech:gt.metaitem.01:30641";
    const reactor = catalog.recipes(catalog.resolve(target)).find(r => r.machine === "Chemical Reactor" && r.durationTicks === 480 && r.eut === 120 && r.inputs.some(io => io.id === filled) && r.outputs.some(io => io.id === empty));
    const cannerId = version === "2.8.0" ? "r~9HnaZz-0MLGhv9LG6kwENw==" : "r~7StCimUbPLGtBT0vdXAQRw==";
    const canner = catalog.recipes(catalog.resolve(filled)).find(r => r.id === cannerId && r.durationTicks === 16 && r.inputs.some(io => io.id === empty));
    if (!reactor || !canner) throw new Error("Verified cell-loop recipes missing from this dataset");
    const state = { ...window.GTNH_CALC.getState(), target, amount: 2000, unit: "L", rateMode: "per_second", depth: "full", uiMode: "factory", balanceMode: "steady_state", loopSeeds: {},
      routeChoices: { [target]: reactor.id, [filled]: canner.id }, rawOverrides: [...reactor.inputs, ...canner.inputs].filter(io => io.amount > 0 && ![empty, filled].includes(io.id)).map(io => io.id) };
    window.GTNH_CALC.import(JSON.stringify({ format: "gtnh-atlas-plan", schemaVersion: 4, dataset: { id: catalog.dataset.id, sha256: catalog.dataset.sha256 }, settings: state }));
    return { target, empty, reactor: reactor.id, canner: canner.id };
  }, version);
  await page.locator('[data-calc-tab="tree"]').click(); await expect(page.locator("[data-balance-status=blocked]")).toContainText("Declare circulating startup stock");
  await page.locator("#plannerEditLoopStock").click();
  const seed = page.locator(`[data-loop-seed="${anchor.empty}"]`); await seed.fill("2"); await seed.blur();
  await page.locator('[data-calc-tab="tree"]').click(); await expect(page.locator("[data-balance-status=balanced]")).toContainText("material balance checked");
  const result = await page.evaluate(() => { const plan = window.GTNH_CALC.getPlan(); return { power: plan.knownAverageEut, installed: plan.knownInstalledEut, materials: plan.materials, stock: plan.reusable, steps: plan.steps.length }; });
  expect(result.power).toBe(2880.8); expect(result.installed).toBe(2881); expect(result.steps).toBe(2);
  expect(result.materials.some(row => row.id === anchor.empty)).toBe(false); expect(result.stock.find(row => row.id === anchor.empty).amount).toBe(2);
  await page.screenshot({ path: info.outputPath(`returned-cell-loop-${version}.png`) });
  await page.locator('[data-calc-tab="code"]').click(); await page.locator('[data-planner-code="json"]').click();
  const saved = JSON.parse(await page.locator("#calcCodeOut").inputValue()); expect(saved.schemaVersion).toBe(4); expect(saved.settings.loopSeeds[anchor.empty]).toBe(2);
  await page.reload(); await expect(page.locator('#bootLoader[data-state="ready"]')).toBeAttached(); await page.locator("#toolCalc").click(); await page.locator("#calcBuild").click();
  await expect(page.locator("[data-balance-status=balanced]")).toBeVisible();
  await page.locator("#plannerEditLoopStock").click(); await page.locator(`[data-loop-seed="${anchor.empty}"]`).fill("0"); await page.locator(`[data-loop-seed="${anchor.empty}"]`).blur();
  await page.locator('[data-calc-tab="code"]').click(); await page.locator('[data-planner-code="yaml"]').click();
  await expect(page.locator("#calcCodeOut")).toHaveValue(/No executable recycling plan exported/);
});
