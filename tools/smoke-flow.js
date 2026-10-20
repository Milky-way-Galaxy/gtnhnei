// Opt-in integration check: downloads the real Pyodide packages and Viz.js.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { setTimeout as pause } from "node:timers/promises";
import { chromium, devices } from "@playwright/test";
const root = resolve(import.meta.dirname, ".."),
  base = "http://127.0.0.1:4173/gtnhnei/";
const dataset = process.env.ATLAS_SMOKE_DATASET || "gtnh-2.9.0";
const anchors = {
  "gtnh-2.8.0": {
    route: "r~7CR1mklsMhyejhfODug_QQ==",
    hydrogen: "f:GalacticraftMars:hydrogen",
  },
  "gtnh-2.9.0": {
    route: "r~RgUYVgBcPJmt4u3DO2ZYIg==",
    hydrogen: "f:gregtech:hydrogen",
  },
};
assert.ok(anchors[dataset], "No verified smoke anchor for this dataset");
let server, browser;
async function isServing() {
  try {
    return (await fetch(base)).ok;
  } catch {
    return false;
  }
}
try {
  if (!(await isServing())) {
    server = spawn(process.execPath, [resolve(root, "tools/serve.js"), "--staged"], {
      cwd: root,
      stdio: "ignore",
    });
    for (let attempt = 0; attempt < 50 && !(await isServing()); attempt++)
      await pause(100);
    assert.ok(await isServing(), "The local preview server could not start");
  }
  const configuredProxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
  let proxy;
  if (configuredProxy) {
    const url = new URL(configuredProxy);
    proxy = {
      server: `${url.protocol}//${url.host}`,
      bypass: "127.0.0.1,localhost",
      ...(url.username
        ? {
            username: decodeURIComponent(url.username),
            password: decodeURIComponent(url.password),
          }
        : {}),
    };
  }
  browser = await chromium.launch({
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {}),
    ...(proxy ? { proxy } : {}),
  });
  const context = await browser.newContext({
      ...devices["Pixel 7"],
      viewport: { width: 390, height: 844 },
    }),
    page = await context.newPage(),
    errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() =>
    localStorage.setItem("gtnhnei_help_seen", "1"),
  );
  console.log(`Loading real ${dataset} factory and browser solver…`);
  await page.goto(`${base}?dataset=${dataset}`);
  await page
    .locator('#bootLoader[data-state="ready"]')
    .waitFor({ state: "attached", timeout: 60000 });
  const metrics = await page.evaluate(
    ({ dataset, anchor }) => {
      const catalog = window.GTNH_CATALOG,
        target = "f:gregtech:liquid_epichlorhydrin",
        state = window.GTNH_CALC.getState();
      if (catalog.dataset.id !== dataset)
        throw new Error("Smoke dataset identity mismatch");
      Object.assign(state, {
        target,
        amount: 3000,
        unit: "L",
        rateMode: "per_minute",
        depth: "1",
        routeChoices: { [target]: anchor.route },
        additionalTargets: [
          { target: anchor.hydrogen, amount: 6000, unit: "L", machineCount: 1 },
        ],
      });
      state.settings.reuseByproducts = true;
      state.settings.waterFree = false;
      window.GTNH_CALC.import(
        JSON.stringify({
          format: "gtnh-atlas-plan",
          schemaVersion: 2,
          dataset: { id: catalog.dataset.id, sha256: catalog.dataset.sha256 },
          settings: state,
        }),
      );
      window.GTNH_CALC.open();
      window.GTNH_CALC.build();
      const plan = window.GTNH_CALC.getPlan();
      return {
        outputs: plan.targets.length,
        hydrogen: plan.byproductsUsed.find((row) => row.id === anchor.hydrogen)
          ?.amount,
        averageEut: plan.knownAverageEut,
        installedEut: plan.knownInstalledEut,
        installedCapacity: plan.targets[0].installedCapacity,
      };
    },
    { dataset, anchor: anchors[dataset] },
  );
  assert.deepEqual(metrics, {
    outputs: 2,
    hydrogen: 100,
    averageEut: 48,
    installedEut: 60,
    installedCapacity: 62.5,
  });
  const artifacts = resolve(root, "test-results/real-flow-smoke", dataset);
  await mkdir(artifacts, { recursive: true });
  await page.locator('[data-calc-tab="tree"]').click();
  await page.screenshot({ path: resolve(artifacts, "factory-mobile.png") });
  await page.locator('[data-calc-tab="code"]').click();
  await page.locator('[data-planner-code="yaml"]').click();
  const yaml = await page.locator("#calcCodeOut").inputValue();
  await writeFile(resolve(artifacts, "factory.yaml"), yaml);
  await page.locator("#gtnhFlowCalcTab").click();
  async function rendered() {
    await page.waitForFunction(
      () =>
        /Rendered|failed/i.test(
          document.getElementById("gtnhFlowBrowserStatus")?.textContent || "",
        ),
      {},
      { timeout: 180000 },
    );
    const status = await page.locator("#gtnhFlowBrowserStatus").textContent();
    assert.match(status, /Rendered gtnh-flow/);
    await page
      .locator("#gtnhFlowBrowserViewer svg")
      .waitFor({ state: "visible" });
    const text = await page.locator("#gtnhFlowBrowserViewer").innerText();
    assert.match(text, /Input EU\/t:\s*-48\b/);
    assert.match(text, /Total machine count:\s*1\.6\b/);
    assert.match(text, /50\.0\/s/);
    assert.match(text, /100\.0\/s/);
    return text;
  }
  await rendered();
  await page.locator('[data-planner-code="json"]').click();
  await page.locator("#calcCodeOut").waitFor({ state: "visible" });
  assert.equal(
    JSON.parse(await page.locator("#calcCodeOut").inputValue()).dataset.id,
    dataset,
  );
  await page.locator("#gtnhFlowCalcTab").click();
  await page.locator("#gtnhFlowBrowserRun").click();
  const flow = await rendered();
  await writeFile(resolve(artifacts, "flow.txt"), flow);
  const svg = await page
    .locator("#gtnhFlowBrowserViewer svg")
    .evaluate((element) => new XMLSerializer().serializeToString(element));
  await writeFile(resolve(artifacts, "factory.svg"), svg);
  await page.locator("#gtnhFlowBrowserViewer").scrollIntoViewIfNeeded();
  await page.screenshot({ path: resolve(artifacts, "flow-mobile.png") });
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify(
      {
        dataset,
        ...metrics,
        realPyodideAndViz: true,
        tabSwitchRecovery: true,
        artifacts,
      },
      null,
      2,
    ),
  );
} finally {
  await browser?.close();
  server?.kill();
}
