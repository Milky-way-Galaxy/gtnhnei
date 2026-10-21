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
const scenario = process.env.ATLAS_SMOKE_SCENARIO || "factory";
assert.ok(["factory", "cell-loop"].includes(scenario), "Unknown smoke scenario");
const anchors = {
  "gtnh-2.8.0": {
    route: "r~7CR1mklsMhyejhfODug_QQ==",
    hydrogen: "f:GalacticraftMars:hydrogen",
    cellReactor: "r~-5WYqt_OOQOL1KobhH2Etg==", cellCanner: "r~9HnaZz-0MLGhv9LG6kwENw==", nitric: "f:dreamcraft:nitricacid",
  },
  "gtnh-2.9.0": {
    route: "r~RgUYVgBcPJmt4u3DO2ZYIg==",
    hydrogen: "f:gregtech:hydrogen",
    cellReactor: "r~1jyMrKp6Mnu8UAcnQIeCKw==", cellCanner: "r~7StCimUbPLGtBT0vdXAQRw==", nitric: "f:gregtech:nitricacid",
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
    ({ dataset, anchor, scenario }) => {
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
      if (scenario === "cell-loop") Object.assign(state, {
        target: "f:gregtech:tetranitromethane", amount: 2000, rateMode: "per_second", depth: "full", balanceMode: "steady_state",
        routeChoices: { "f:gregtech:tetranitromethane": anchor.cellReactor, "i:gregtech:gt.metaitem.01:30641": anchor.cellCanner },
        loopSeeds: { "i:IC2:itemCellEmpty:0": 2 }, rawOverrides: [anchor.nitric, "f:gregtech:ethenone"], additionalTargets: [],
      });
      window.GTNH_CALC.import(
        JSON.stringify({
          format: "gtnh-atlas-plan",
          schemaVersion: scenario === "cell-loop" ? 4 : 2,
          dataset: { id: catalog.dataset.id, sha256: catalog.dataset.sha256 },
          settings: state,
        }),
      );
      window.GTNH_CALC.open();
      window.GTNH_CALC.build();
      const plan = window.GTNH_CALC.getPlan();
      if (scenario === "cell-loop") return { outputs: plan.targets.length, averageEut: plan.knownAverageEut, installedEut: plan.knownInstalledEut,
        balance: plan.balance.status, machineCount: plan.steps.reduce((n, row) => n + row.count, 0), circulatingStock: plan.reusable.find(row => row.id === "i:IC2:itemCellEmpty:0")?.amount };
      return {
        outputs: plan.targets.length,
        hydrogen: plan.byproductsUsed.find((row) => row.id === anchor.hydrogen)
          ?.amount,
        averageEut: plan.knownAverageEut,
        installedEut: plan.knownInstalledEut,
        installedCapacity: plan.targets[0].installedCapacity,
      };
    },
    { dataset, anchor: anchors[dataset], scenario },
  );
  if (scenario === "factory") assert.deepEqual(metrics, {
    outputs: 2,
    hydrogen: 100,
    averageEut: 48,
    installedEut: 60,
    installedCapacity: 62.5,
  });
  else assert.deepEqual(metrics, { outputs: 1, averageEut: 2880.8, installedEut: 2881, balance: "balanced", machineCount: 25, circulatingStock: 2 });
  const artifacts = resolve(root, "test-results/real-flow-smoke", dataset, ...(scenario === "cell-loop" ? ["cell-loop"] : []));
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
    assert.match(status, /Rendered gtnh-flow/, await page.locator("#gtnhFlowBrowserViewer").textContent());
    await page
      .locator("#gtnhFlowBrowserViewer svg")
      .waitFor({ state: "visible" });
    const text = await page.locator("#gtnhFlowBrowserViewer").innerText();
    await writeFile(resolve(artifacts, "last-render.txt"), text);
    if (scenario === "factory") {
      assert.match(text, /Input EU\/t:\s*-48\b/);
      assert.match(text, /Total machine count:\s*1\.6\b/);
      assert.match(text, /50\.0\/s/);
      assert.match(text, /100\.0\/s/);
    } else {
      assert.match(text, /tetranitromethane/i);
      assert.match(text, /Total machine count:\s*24\.8\b/);
      // The diagram formats SI quantities to limited precision. Check its
      // displayed power against the engine within half the last printed digit.
      const power = text.match(/Input EU\/t:\s*(-?[\d,.]+)([kKMG]?)/);
      assert.ok(power, "Flow did not report input power");
      const value = power[1].replaceAll(",", ""), scale = { "": 1, k: 1e3, K: 1e3, M: 1e6, G: 1e9 }[power[2]];
      const quantum = scale * 10 ** -(value.split(".")[1]?.length || 0);
      assert.ok(Math.abs(Number(value) * scale + 2880.8) <= quantum / 2 + 1e-8, "Displayed flow power differs from the checked recipe balance");
    }
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
        scenario,
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
