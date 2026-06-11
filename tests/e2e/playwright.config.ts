/**
 * Playwright Configuration for E2E Tests
 *
 * Configured for Prospecting OS at app.flow-forges.com/prospecting-os.
 * Uses Chromium in headless mode with 5-minute test timeout.
 */

import { defineConfig } from "@playwright/test";

const APP_URL = process.env.APP_URL || "http://localhost:3000";
const BASE_PATH = "/prospecting-os";

export default defineConfig({
  testDir: "../e2e/steps",
  timeout: 5 * 60 * 1000, // 5 minutes per test
  expect: {
    timeout: 30 * 1000, // 30 seconds for assertions
  },
  use: {
    baseURL: `${APP_URL}${BASE_PATH}`,
    browserName: "chromium",
    headless: true,
    viewport: { width: 1440, height: 900 },
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    trace: "retain-on-failure",
    actionTimeout: 15 * 1000, // 15 seconds for actions
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
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ["list"],
    ["html", { open: "never" }],
    ["json", { outputFile: "test-results/results.json" }],
  ],
  outputDir: "test-results/",
});
