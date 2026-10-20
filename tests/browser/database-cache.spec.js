import { test, expect } from "@playwright/test";
async function ready(page) { await expect(page.locator('#bootLoader[data-state="ready"]')).toBeAttached(); }
test("returning visits use checked local data and recover a damaged cache", async ({ page }) => {
  let downloads = 0;
  page.on("request", request => { if (request.url().endsWith("/data/data.bin")) downloads++; });
  await page.goto("./"); await ready(page);
  expect(await page.evaluate(() => window.GTNH_DATABASE_LOAD)).toMatchObject({ source: "network", saved: true, databaseMs: expect.any(Number), startupMs: expect.any(Number) });
  await page.reload(); await ready(page);
  expect(await page.evaluate(() => window.GTNH_DATABASE_LOAD.source)).toBe("cache");
  expect(downloads).toBe(1);
  const metadata = await page.evaluate(async () => {
    const { databaseCache } = await import("./database-cache.js");
    const records = await databaseCache.list();
    await databaseCache.put(window.GTNH_DATASETS.active, new ArrayBuffer(32));
    return records;
  });
  expect(metadata[0].bytes).toBeGreaterThan(45000000); expect(metadata[0].buffer).toBeUndefined();
  await page.reload(); await ready(page);
  expect(downloads).toBe(2);
  expect(await page.evaluate(() => window.GTNH_DATABASE_LOAD.source)).toBe("network");
});
test("cache revision replacement is atomic and other pack versions are retained", async ({ page }) => {
  await page.goto("./"); await ready(page);
  const result = await page.evaluate(async () => {
    const { databaseCache } = await import("./database-cache.js");
    const dataset = { ...window.GTNH_DATASETS.active, id: "cache-test" };
    await databaseCache.put(dataset, new ArrayBuffer(32));
    await databaseCache.put({ ...dataset, uncompressedSha256: "b".repeat(64) }, new ArrayBuffer(64));
    return (await databaseCache.list()).map(entry => ({ datasetId: entry.datasetId, bytes: entry.bytes }));
  });
  expect(result).toEqual(expect.arrayContaining([{ datasetId: "gtnh-2.8.0", bytes: expect.any(Number) }, { datasetId: "cache-test", bytes: 64 }]));
  expect(result).toHaveLength(2);
});
