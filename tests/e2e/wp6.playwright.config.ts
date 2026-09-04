import { resolve } from "node:path";
import { defineConfig, devices } from "@playwright/test";

const workspace = resolve(import.meta.dirname, "../..");

export default defineConfig({
  testDir: ".",
  testMatch: "wp6-campaign-hud.e2e.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 10_000 },
  reporter: [
    ["list"],
    ["json", { outputFile: resolve(workspace, ".omo/evidence/pax-parity/playwright.json") }],
  ],
  use: {
    baseURL: "http://127.0.0.1:5273",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    locale: "ko-KR",
  },
  projects: [
    {
      name: "chrome",
      use: {
        ...devices["Desktop Chrome"],
        channel: "chrome",
        viewport: { width: 1280, height: 800 },
      },
    },
  ],
  webServer: [
    {
      command: "bun tests/e2e/wp6-api-server.ts",
      cwd: workspace,
      url: "http://127.0.0.1:3100/api/campaigns",
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: "node node_modules/vite/bin/vite.js --config tests/e2e/wp6-vite.config.ts",
      cwd: workspace,
      url: "http://127.0.0.1:5273",
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
