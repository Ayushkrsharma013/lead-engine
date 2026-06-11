import { defineConfig } from "@playwright/test";

const APP_URL = process.env.APP_URL || "http://localhost:3000";
const BASE_PATH = "/prospecting-os";
const isCI = !!process.env.CI;

export default defineConfig({
  testDir: "../e2e/steps",
  timeout: 5 * 60 * 1000,
  expect: {
    timeout: 30 * 1000,
  },
  use: {
    baseURL: `${APP_URL}${BASE_PATH}`,
    browserName: "chromium",
    headless: isCI,
    slowMo: isCI ? 0 : 300,
    viewport: { width: 1440, height: 900 },
    screenshot: "on",
    video: "on-first-retry",
    trace: "on-first-retry",
    actionTimeout: 15 * 1000,
  },
  projects: [
    {
      name: "chromium",
      use: {
        browserName: "chromium",
        launchOptions: {
          args: [
            "--disable-dev-shm-usage",
            "--no-sandbox",
            "--disable-setuid-sandbox",
          ],
        },
      },
    },
  ],
  retries: isCI ? 2 : 0,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "../reports/html" }],
    ["json", { outputFile: "../reports/results.json" }],
    ["junit", { outputFile: "../reports/junit.xml" }],
  ],
  outputDir: "../reports/playwright-output/",
});
