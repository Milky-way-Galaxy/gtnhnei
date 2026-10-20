import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
const target = "f:gregtech:liquid_epichlorhydrin",
  route = "r~7CR1mklsMhyejhfODug_QQ==";
const vizModule = `export async function instance(){return{renderSVGElement(){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 100 100');svg.setAttribute('width','100');svg.setAttribute('height','100');const text=document.createElementNS('http://www.w3.org/2000/svg','text');text.textContent='Test diagram';svg.appendChild(text);return svg;}};}`;
async function setup(page, failFirst = false) {
  const requests = [];
  await page.addInitScript(() =>
    localStorage.setItem("gtnhnei_help_seen", "1"),
  );
  await page.route("**/gtnhflow-pyodide-worker.js*", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `self.onmessage=({data})=>self.postMessage({type:'dot',id:data.id,dot:'digraph {a -> b}'});`,
    }),
  );
  await page.route(
    /https:\/\/cdn\.jsdelivr\.net\/npm\/@viz-js\/viz@3\.27\.0\/\+esm(?:\?.*)?$/,
    async (route) => {
      requests.push(route.request().url());
      await route.fulfill({
        status: failFirst && requests.length === 1 ? 503 : 200,
        contentType: "application/javascript",
        headers: { "access-control-allow-origin": "*" },
        body: vizModule,
      });
    },
  );
  await page.goto("./");
  await expect(page.locator('#bootLoader[data-state="ready"]')).toBeAttached();
  await page.locator("#toolCalc").click();
  await page.locator("#calcTarget").fill(target);
  await page.locator("#calcUnit").selectOption("L");
  await page.locator("#calcBuild").click();
  await page
    .locator(`select[data-route-good="${target}"]`)
    .first()
    .selectOption(route);
  await page.locator('[data-calc-tab="code"]').click();
  return requests;
}
test("a failed Viz module can retry with a fresh request instead of reusing a rejected promise", async ({
  page,
}) => {
  const requests = await setup(page, true);
  await page.locator("#gtnhFlowCalcTab").click();
  await expect(page.locator("#gtnhFlowBrowserStatus")).toContainText(
    "Viz.js render failed",
  );
  await page.locator("#gtnhFlowBrowserRun").click();
  await expect(page.locator("#gtnhFlowBrowserViewer svg")).toBeVisible();
  expect(requests).toHaveLength(2);
  expect(requests[1]).not.toBe(requests[0]);
});
test("YAML, flow and JSON views can switch repeatedly without hiding the workspace or export field", async ({
  page,
}) => {
  await setup(page);
  await page.locator('[data-planner-code="yaml"]').click();
  await expect(page.locator("#calcCodeOut")).toBeVisible();
  await page.locator("#gtnhFlowCalcTab").click();
  await expect(page.locator("#gtnhFlowBrowserViewer svg")).toBeVisible();
  await page.locator('[data-planner-code="json"]').click();
  await expect(page.locator("#calcCodeOut")).toBeVisible();
  await expect(page.locator("#gtnhFlowBrowserPanel")).not.toBeVisible();
  expect(
    JSON.parse(await page.locator("#calcCodeOut").inputValue()).dataset.id,
  ).toBe("gtnh-2.8.0");
  await page.locator("#gtnhFlowCalcTab").click();
  await expect(page.locator("#gtnhFlowBrowserViewer svg")).toBeVisible();
  await page.locator("#gtnhFlowCalcTab").click();
  await expect(page.locator("#gtnhFlowBrowserViewer svg")).toBeVisible();
  await expect(page.locator(".gtnhCalcPanel")).toBeVisible();
});
test("blocked flow clipboard access gives a recoverable message without an unhandled rejection", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await setup(page);
  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: () => Promise.reject(new Error("blocked")) },
    });
  });
  await page.locator("#gtnhFlowCalcTab").click();
  await expect(page.locator("#gtnhFlowBrowserViewer svg")).toBeVisible();
  await page.locator("#gtnhFlowBrowserCopyYaml").click();
  await expect(page.locator("#gtnhFlowBrowserStatus")).toContainText(
    "Clipboard",
  );
  const pending = page.waitForEvent("download");
  await page.locator("#gtnhFlowBrowserDownloadDot").click();
  const file = await pending;
  expect(file.suggestedFilename()).toMatch(/\.dot$/);
  expect(await readFile(await file.path(), "utf8")).toBe("digraph {a -> b}");
  expect(errors).toEqual([]);
});
test("unbuilt changes cannot render a fallback route or initialize solver dependencies", async ({
  page,
}) => {
  const requests = await setup(page);
  await page.locator('[data-calc-tab="planner"]').click();
  await page.locator("#calcAmount").fill("2");
  await page.locator('[data-calc-tab="code"]').click();
  await page.locator("#gtnhFlowCalcTab").click();
  await expect(page.locator("#gtnhFlowBrowserStatus")).toContainText(
    "Build a production plan",
  );
  expect(requests).toHaveLength(0);
  await expect(page.locator("#gtnhFlowBrowserViewer svg")).toHaveCount(0);
  expect(await page.evaluate(() => window.GTNH_CALC.getPlan())).toBeNull();
});
