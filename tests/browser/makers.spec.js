import { test, expect } from "@playwright/test";
const target = "f:gregtech:liquid_epichlorhydrin", route = "r~7CR1mklsMhyejhfODug_QQ==";
let exceptions;
test.beforeEach(async ({ page }) => {
  exceptions = [];
  page.on("pageerror", error => exceptions.push(error.message));
  await page.addInitScript(() => localStorage.setItem("gtnhnei_help_seen", "1"));
});
test.afterEach(() => expect(exceptions).toEqual([]));
async function start(page) {
  await page.goto("./"); await expect(page.locator('#bootLoader[data-state="ready"]')).toBeAttached();
  await page.evaluate(() => window.GTNH_MATCALC.open());
  await page.locator("#matTarget").fill(target);
}
test("explicit material routes override maker defaults and exact-ID choices isolate duplicate names", async ({ page }) => {
  await start(page);
  expect(await page.evaluate(target => window.GTNH_MAKER_API.setMaker(target, 1), target)).toBe(true);
  await page.locator("#matRoute").fill("1"); await page.locator("#matCalculate").click();
  expect(await page.evaluate(() => window.GTNH_MATCALC.lastPlan.root.recipeId)).toBe(route);
  const result = await page.evaluate(() => {
    const c = window.GTNH_CATALOG, api = window.GTNH_MAKER_API;
    const [a, b] = [...c.byName.values()].find(values => values.length > 1);
    api.setExternalInput(a.id);
    const isolated = api.isExternalInput(a.id) && !api.isExternalInput(b.id);
    const ambiguousRoutes = api.routeCandidates(a.name).length;
    api.clearChoice(a.id);
    return { isolated, ambiguousRoutes, cleared: !api.isExternalInput(a.id), stored: api.getState().makers["f:gregtech:liquid_epichlorhydrin"] };
  });
  expect(result.isolated).toBe(true); expect(result.ambiguousRoutes).toBe(0); expect(result.cleared).toBe(true);
  expect(result.stored.goodId).toBe(target);
  await page.reload(); await expect(page.locator('#bootLoader[data-state="ready"]')).toBeAttached();
  expect(await page.evaluate(target => window.GTNH_MAKER_API.routeFor(target), target)).toBe(1);
});
test("navigation and maker decorations settle without rewriting labels or corrupting material identities", async ({ page }) => {
  await start(page); await page.locator("#matCalculate").click();
  await expect(page.locator(".makerChoiceInlineBtn").first()).toBeVisible();
  await page.evaluate(() => {
    window.idleWrites = 0;
    const observer = new MutationObserver(changes => window.idleWrites += changes.length);
    for (const element of [document.getElementById("gtnhTopStrip"), document.getElementById("toolCalc").parentNode, document.getElementById("matResults")].filter(Boolean)) observer.observe(element, { childList: true, subtree: true });
    window.dispatchEvent(new Event("resize"));
  });
  await page.waitForTimeout(700);
  expect(await page.evaluate(() => window.idleWrites)).toBe(0);
  const row = page.locator("#matResults tbody tr").first(), id = await row.getAttribute("data-good-id");
  await row.locator(".makerChoiceInlineBtn").click();
  await expect(page.locator("#gtnhMakerChoiceTarget")).toContainText(id);
});
test("ignored materials migrate to exact IDs and the picker reads structured recipes without YAML", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("gtnh_material_calc_state_v4", JSON.stringify({ manualIgnored: ["mercury"] })));
  await start(page); await page.locator("#matCalculate").click();
  expect(await page.evaluate(() => window.GTNH_MATCALC.lastPlan.materials.some(row => row.name === "Mercury"))).toBe(false);
  const ids = await page.evaluate(() => {
    window.GTNHNEI_FLOW_EXPORT_API.yamlForRecipe = () => { throw new Error("Picker must not parse YAML"); };
    const p = window.GTNH_MATCALC.lastPlan;
    return { chlorine: p.materials.find(row => row.name === "Chlorine").id, hydrogen: p.byproducts.find(row => row.name === "Hydrogen").id };
  });
  await page.locator("#matOpenIgnorePicker").click();
  await expect(page.locator(`.gtnhIgnoreChip[data-name="${ids.hydrogen}"]`)).toBeVisible();
  await page.locator(`.gtnhIgnoreChip[data-name="${ids.chlorine}"]`).click();
  await page.locator("#gtnhIgnoreRecalc").click();
  const state = await page.evaluate(() => ({ rows: window.GTNH_MATCALC.getLastRows(), ignored: window.GTNH_MATCALC.getManualIgnored() }));
  expect(state.rows.some(row => row.name === "Chlorine")).toBe(false);
  expect(state.ignored).toContain(ids.chlorine);
  expect(state.ignored).not.toContain("mercury");
});
test("material calculations work with blocked settings storage and clear stale results after invalid input", async ({ page }) => {
  await page.addInitScript(() => {
    const get = Storage.prototype.getItem, set = Storage.prototype.setItem;
    Storage.prototype.getItem = function(key) { if (key.startsWith("gtnh_material_calc")) throw new Error("Storage unavailable"); return get.call(this, key); };
    Storage.prototype.setItem = function(key, value) { if (key.startsWith("gtnh_material_calc")) throw new Error("Storage unavailable"); return set.call(this, key, value); };
  });
  await start(page); await page.locator("#matCalculate").click();
  expect(await page.evaluate(() => window.GTNH_MATCALC.lastPlan.knownEnergy)).toBe(19200);
  await page.locator("#matAmount").fill("-1"); await page.locator("#matCalculate").click();
  await expect(page.locator("#matErrors")).toContainText("greater than zero");
  expect(await page.evaluate(() => window.GTNH_MATCALC.lastPlan)).toBeNull();
  expect(await page.evaluate(() => window.GTNH_MATCALC.getLastRows().length)).toBe(0);
});
