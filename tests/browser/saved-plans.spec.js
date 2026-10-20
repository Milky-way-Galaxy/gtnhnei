import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createPlanLink } from "../../plan-share.js";
import { readFileSync } from "node:fs";
const target = "f:gregtech:liquid_epichlorhydrin",
  route = "r~7CR1mklsMhyejhfODug_QQ==";
const dataset = JSON.parse(
  readFileSync(new URL("../../data/manifest.json", import.meta.url)),
).datasets[0];
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("gtnhnei_help_seen", "1"),
  );
});
async function ready(page) {
  await expect(page.locator('#bootLoader[data-state="ready"]')).toBeAttached();
}
async function start(page) {
  await page.goto("./");
  await ready(page);
  await page.locator("#toolCalc").click();
  await page.locator("#calcTarget").fill(target);
  await page.locator("#calcAmount").fill("2000");
  await page.locator("#calcUnit").selectOption("L");
  await page.locator("#calcBuild").click();
  await page
    .locator(`select[data-route-good="${target}"]`)
    .first()
    .selectOption(route);
  await page.locator('[data-calc-tab="planner"]').click();
  await page.locator("#plannerLibrary > summary").click();
}
test("named real plans save, replace, reload, download, delete and undo with focus returning to the opener", async ({
  page,
}) => {
  await start(page);
  await page.locator("#plannerPlanName").fill("Epichlorohydrin plant");
  await page.locator("#plannerSaveNew").click();
  const first = await page.locator("#plannerSavedPlan").inputValue();
  expect(first).not.toBe("");
  await page.locator("#calcAmount").fill("3000");
  await page.locator("#plannerPlanName").fill("Expanded plant");
  await page.locator("#plannerSaveNew").click();
  const second = await page.locator("#plannerSavedPlan").inputValue();
  expect(second).not.toBe(first);
  await page.locator("#plannerSavedPlan").selectOption(first);
  await page.locator("#plannerLoadSaved").click();
  expect(
    await page.evaluate(() => window.GTNH_CALC.getPlan().knownEnergy),
  ).toBe(38400);
  await page.locator('[data-calc-tab="planner"]').click();
  await page.locator("#plannerDeleteSaved").click();
  await expect(page.locator("#plannerUndoDelete")).toBeVisible();
  await page.locator("#plannerUndoDelete").click();
  await expect(page.locator("#plannerSavedPlan")).toHaveValue(first);
  await page.locator("#calcAmount").fill("4000");
  await page.locator("#plannerPlanName").fill("Updated plant");
  await page.locator("#plannerReplaceSaved").click();
  const pending = page.waitForEvent("download");
  await page.locator("#plannerDownloadSaved").click();
  const downloaded = JSON.parse(
    await readFile(await (await pending).path(), "utf8"),
  );
  expect(downloaded.settings.amount).toBe(4000);
  expect(downloaded.settings.routeChoices[target]).toBe(route);
  await page.locator("#gtnhCalcClose").click();
  await expect(page.locator("#toolCalc")).toBeFocused();
  await page.reload();
  await ready(page);
  await page.locator("#toolCalc").click();
  await page.locator("#plannerLibrary > summary").click();
  await expect(page.locator("#plannerSavedPlan option")).toHaveCount(3);
  await page.locator("#plannerSavedPlan").selectOption(first);
  await page.locator("#plannerLoadSaved").click();
  expect(
    await page.evaluate(() => window.GTNH_CALC.getPlan().knownEnergy),
  ).toBe(76800);
});
test("real factory links restore their whole configuration only after an explicit load", async ({
  page,
}) => {
  await start(page);
  await page.evaluate(() => {
    const state = window.GTNH_CALC.getState();
    state.additionalTargets = [
      {
        target: "f:GalacticraftMars:hydrogen",
        amount: 4000,
        unit: "L",
        machineCount: 1,
      },
    ];
    state.settings.reuseByproducts = true;
    window.GTNH_CALC.import(
      JSON.stringify({
        format: "gtnh-atlas-plan",
        schemaVersion: 2,
        dataset: {
          id: window.GTNH_CATALOG.dataset.id,
          sha256: window.GTNH_CATALOG.dataset.sha256,
        },
        settings: state,
      }),
    );
  });
  await page.locator("#plannerCreateLink").click();
  await expect(page.locator("#plannerShareLink")).toBeVisible();
  const link = await page.locator("#plannerShareLink").inputValue();
  expect(link).toContain("#plan=v1.");
  await page.evaluate(() => {
    const state = window.GTNH_CALC.getState();
    state.amount = 1000;
    state.additionalTargets = [];
    window.GTNH_CALC.import(JSON.stringify(state));
  });
  await page.goto(link);
  await ready(page);
  await expect(page.locator("#sharedPlanBanner")).toContainText(
    "2 output target(s)",
  );
  expect(await page.evaluate(() => window.GTNH_CALC.getState().amount)).toBe(
    1000,
  );
  await page.locator("#loadSharedPlan").click();
  const result = await page.evaluate(() => window.GTNH_CALC.getPlan());
  expect(result.targets.length).toBe(2);
  expect(result.knownEnergy).toBe(38400);
  expect(result.targets[1].root.status).toBe("from-byproduct");
  expect(new URL(page.url()).hash).toBe("");
  await expect(page.locator("#sharedPlanBanner")).toHaveCount(0);
});
test("wrong-version links fail visibly and malformed saved libraries retain their raw stored data", async ({
  page,
}) => {
  const link = await createPlanLink(
    { target, amount: 2, unit: "L" },
    dataset,
    "http://127.0.0.1:4173/gtnhnei/",
  );
  const wrong = new URL(link);
  wrong.searchParams.set("dataset", "gtnh-2.9.0");
  await page.goto(wrong.href);
  await ready(page);
  await expect(page.locator("#sharedPlanBanner")).toContainText(
    "different recipe dataset",
  );
  await expect(page.locator("#loadSharedPlan")).toHaveCount(0);
  await start(page);
  await page.evaluate(() => {
    const dataset = window.GTNH_CATALOG.dataset;
    localStorage.setItem(
      `gtnh_atlas_plan_library_v1:${dataset.id}:${dataset.sha256}`,
      "corrupted library",
    );
  });
  await page.locator("#plannerPlanName").fill("Keep original data");
  await page.locator("#plannerSaveNew").click();
  await expect(page.locator("#plannerLibraryStatus")).toContainText("retained");
  expect(
    await page.evaluate(() => {
      const dataset = window.GTNH_CATALOG.dataset;
      return localStorage.getItem(
        `gtnh_atlas_plan_library_v1:${dataset.id}:${dataset.sha256}`,
      );
    }),
  ).toBe("corrupted library");
  expect(await page.evaluate(() => window.GTNH_CALC.getState().target)).toBe(
    target,
  );
});
