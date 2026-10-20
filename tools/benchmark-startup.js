import { chromium, devices } from "@playwright/test";
import { spawn } from "node:child_process";
const base = "http://127.0.0.1:4173/gtnhnei/";
let server;
try {
  if (!await fetch(base).then(response => response.ok).catch(() => false)) {
    server = spawn(process.execPath, ["tools/serve.js", "--staged"], { stdio: "ignore" });
    for (let attempt = 0; attempt < 50; attempt++) {
      if (await fetch(base).then(response => response.ok).catch(() => false)) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH });
  try {
    const results = [];
    for (const [device, options] of [["Desktop Chromium", devices["Desktop Chrome"]], ["Pixel 7 emulation", devices["Pixel 7"]]]) {
      for (const version of ["2.8.0", "2.9.0"]) {
        const context = await browser.newContext(options), page = await context.newPage();
        let downloadBytes = 0;
        page.on("response", response => { if (response.url().endsWith("data.bin")) downloadBytes += Number(response.headers()["content-length"] || 0); });
        const samples = [];
        for (let visit = 0; visit < 3; visit++) {
          if (visit) await page.reload(); else await page.goto(`${base}?dataset=gtnh-${version}`);
          await page.waitForSelector('#bootLoader[data-state="ready"]', { state: "attached", timeout: 60000 });
          samples.push(await page.evaluate(() => window.GTNH_DATABASE_LOAD));
        }
        results.push({ device, version, downloadedDatabaseBytes: downloadBytes, samples }); await context.close();
      }
    }
    console.log(JSON.stringify({ environment: "Local HTTP server; no network or CPU throttling. Startup callback timing excludes initial script/style downloads. First visit includes verified cache write; returns retain integrity checking and index construction.", results }, null, 2));
  } finally { await browser.close(); }
} finally { server?.kill(); }
