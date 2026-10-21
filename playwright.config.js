import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  timeout: 60000,
  expect: { timeout: 15000 },
  workers: 2,
  use: {
    baseURL: "http://127.0.0.1:4173/gtnhnei/",
    trace: "retain-on-failure",
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
    ...(process.env.ATLAS_FIREFOX === "1" ? [
      { name: "firefox", use: { ...devices["Desktop Firefox"], launchOptions: {} } }
    ] : [])
  ],
  webServer: { command: "node tools/serve.js --staged", url: "http://127.0.0.1:4173/gtnhnei/", reuseExistingServer: !process.env.CI }
});
